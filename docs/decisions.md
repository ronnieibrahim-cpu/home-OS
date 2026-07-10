# Architectural Decision Log

One short entry per major decision: context, decision, why. Newest at the bottom.

---

## ADR-001 — One `assets` table for every kind of asset

**Context:** Phase 1 must track appliances, vehicles, systems, furniture. Separate tables per
kind (a `vehicles` table, an `appliances` table…) were considered.

**Decision:** A single `assets` table with a `category` field and a free-form `details` JSONB
field for type-specific facts (VIN, mileage, tonnage). Confirmed with the product owner.

**Why:** All asset kinds share ~90% of their fields and 100% of their behavior (location,
maintenance, expenses, notes, attachments). One table means one code path everywhere. If a kind
ever needs real structure (e.g. mileage-based maintenance), we promote those `details` keys to
columns in a migration at that point — not before.

---

## ADR-002 — House parts are assets (category `system`)

**Context:** Some maintenance isn't tied to an appliance: gutter cleaning, roof inspection, lawn
treatment. Alternative considered: let maintenance schedules attach to either an asset *or* a
home (two nullable links).

**Decision:** Parts of the house that need upkeep are created as assets — "Gutters", "Roof",
"Lawn" — with category `system`. Every maintenance schedule requires an asset. Confirmed with
the product owner.

**Why:** One uniform mechanism. House parts get the same service history, photos, and receipts
as any appliance, and there is never a "which way do I do this?" question. Cost: a few one-time
asset entries during setup.

---

## ADR-003 — Two money tables: recurring commitments vs. actual expenses

**Context:** The dashboard's core question is "what does our life cost per month?", but the
family also spends one-time money and pays real bills. A single expenses table with an
`is_recurring` flag was considered.

**Decision:** `recurring_expenses` holds ongoing commitments (mortgage ~$X/mo); `expenses` holds
actual dated transactions. An expense may optionally link back to the commitment it fulfills
(`recurring_expense_id`). Logging actual bills is opt-in. Confirmed with the product owner.

**Why:** They answer different questions — "what do we owe monthly?" (forecast) vs. "what did we
spend?" (history) — and the dashboard needs them separated anyway. The optional link means
forecasting works from day one with zero bill-entry effort, and gets more accurate whenever
actuals are logged.

---

## ADR-004 — Polymorphic notes & attachments with database-enforced cleanup

**Context:** Every entity must be able to carry notes and files (receipts, manuals, photos).
Alternatives: a notes/attachments table per entity (9× duplication), or join tables per entity
(same duplication, more indirection).

**Decision:** One `notes` table and one `attachments` table, each pointing at its owner via
`entity_type` (text) + `entity_id` (uuid). Because Postgres can't enforce a foreign key across
many tables, integrity is enforced two ways in the database itself: a CHECK constraint limits
`entity_type` to the real list of entity tables, and every entity table has an on-delete trigger
that removes its notes and attachment rows.

**Why:** One mechanism for the whole system, future entities join it by adding one word to the
CHECK list and one trigger. The cleanup trigger satisfies the "no orphaned entities" rule at the
database level instead of trusting app code.

**Known gap:** deleting an attachment row cannot delete the file in Supabase Storage (SQL can't
reach Storage). The app must delete the storage object when it deletes an attachment; until then
an unreferenced file merely wastes a little space, it leaks nothing (the bucket is private).

---

## ADR-005 — `text` + CHECK constraints instead of Postgres enums

**Context:** Several fields are pick-lists (asset category, expense category, interval unit,
attachment kind).

**Decision:** Plain `text` columns with CHECK constraints; every list ends in `'other'`.

**Why:** Adding a value to a CHECK is a one-line migration; altering a Postgres enum is
painful and lock-prone. The CHECK still guarantees no garbage values.

---

## ADR-006 — RLS on everywhere; Phase 1 policy is "any authenticated user"

**Context:** Supabase exposes the database to the browser, so Row Level Security is mandatory.
But this is a single household with exactly two trusted users.

**Decision:** Enable RLS on every table from the first migration. The only policy is: an
authenticated user has full read/write access. `household_id` columns exist on top-level tables
as the seam for real membership-scoped policies later. The `attachments` storage bucket is
private with the same authenticated-only rule.

**Why:** RLS-on-by-default means nothing is ever accidentally public. Anything stricter now
would be building multi-tenancy we explicitly aren't building; the seam is kept, per
CLAUDE home os.md.

---

## ADR-007 — Money as integer cents in `bigint`

**Context:** CLAUDE home os.md mandates money as integer cents. Plain `integer` maxes out at
~$21.4 million.

**Decision:** All `*_cents` columns are `bigint`, checked non-negative.

**Why:** A home purchase price in cents approaches the `integer` ceiling uncomfortably;
`bigint` removes the class of bug entirely at zero practical cost.

---

## ADR-008 — Optimistic UI on the money & maintenance surfaces

**Context:** The app is used primarily on an iPhone, where every tap that waits on a
Supabase round-trip feels sluggish. The interactive Phase-1 surfaces — adding a recurring
commitment or expense, marking a maintenance schedule done, deleting a row — are exactly the
taps that recur daily.

**Decision:** These mutations use React 19 `useOptimistic`. The list updates on tap, then a
server action persists the change and calls `revalidatePath`; the refreshed server data rebases
the optimistic state. Server actions on these paths **return a result object and revalidate
instead of `redirect`-ing** (unlike the homes/rooms/assets create actions, which navigate). All
validation and `household_id` resolution stay on the server; the optimistic layer is purely
presentational. The monthly total on the Money screen is recomputed on the client from the same
formula as `v_monthly_recurring_costs`, so it moves the instant a commitment is added.

**Why:** The screen responds immediately while the database syncs in the background — the
iPhone-first feel the product calls for — without moving business logic into the browser or
trusting client-side writes. The full-navigation create/edit flows (homes, rooms, assets) keep
their redirect pattern; only the high-frequency, in-place list mutations are optimistic.

---

## ADR-009 — Deploy on Vercel from GitHub, Supabase keys as env vars

**Context:** CLAUDE home os.md mandates Vercel hosting so the app is reachable from an iPhone
anywhere, not just on the home Wi-Fi.

**Decision:** The GitHub repo is connected to a Vercel project; every push to the default branch
auto-deploys. The two `NEXT_PUBLIC_SUPABASE_*` values are set as Vercel Environment Variables
(not committed — `.env*` is gitignored). No `service_role` key ever reaches Vercel or the
browser; the app talks to Supabase only with the anon key under RLS. Steps are documented in
`docs/deployment.md`.

**Why:** Push-to-deploy keeps operations to zero, and Supabase RLS (ADR-006) means the anon key
is safe to ship to the client. Keeping secrets in Vercel's env store rather than the repo is the
standard, auditable seam.

---

## ADR-010 — Static maintenance/lifespan/depreciation knowledge pack, no schema change

**Context:** The household wants suggested maintenance schedules and a replacement year/cost
estimate for common asset kinds (HVAC, water heater, roof, gutters, vehicles, major appliances)
without calling an external API. Assets have no `subtype` column (ADR-001: type-specific facts
live in `details` JSONB until they earn a real column) and `maintenance_schedules` is calendar-
based only, not mileage-based.

**Decision:** A static knowledge pack ships in the repo at `src/lib/knowledge/` — JSON tables
(`data/subtypes.json`, `data/maintenance-schedules.json`, `data/lifespans.json`,
`data/depreciation-curves.json`), each citing its basis in a `_source` field, plus `pack.ts` for
matching/estimation logic. An asset's "kind" (subtype) is *guessed* by keyword-matching its
`name` against the pack, scoped to its `category`; no new column. The household's confirmation,
dismissed suggestions, and any edited replacement estimate are written into the existing
`assets.details` JSONB column under three conventional keys: `subtype`, `dismissed_suggestions`,
`replacement_year_override` / `replacement_cost_cents_override`. Accepting a suggested schedule
inserts a normal row into `maintenance_schedules` — the pack is purely a source of *defaults*,
never a new source of truth.

**Why:** Keeps the feature entirely inside Phase 1's existing tables (no migration, nothing new
to reflect here beyond this note) while still giving the household one-tap suggestions and an
editable estimate. If subtype ever needs to be reliable (not a guess) or maintenance needs
mileage-based cadence, promote `details.subtype` to a real `assets.subtype` column then — per
ADR-001, not before.

**Known limitation:** subtype matching is a best-effort keyword guess against the asset name; it
can be wrong (hence the always-visible "not right? pick one" control) and only covers the
system/appliance/vehicle categories the pack has data for.

---

## ADR-011 — Budget & Forecast as computed views; home-purchase scenario in the URL

**Context:** The household is 6–18 months from buying a home and wants (a) a true current monthly
budget, (b) a 24-month forward forecast including lumpy maintenance and predicted replacements, and
(c) a home-purchase scenario (PITI, total ownership cost, current-vs-post-purchase comparison) with
price and rate sliders to explore sensitivity. This is Phase-3 scenario modeling, explicitly
requested by the owner. Everything must be deterministic local math — no external APIs — matching
the knowledge-pack philosophy (ADR-010).

**Decision:** Ship a `/budget` screen with three views and **no schema change**. All numbers are
computed from the existing `recurring_expenses`, `maintenance_schedules`, `expenses`, and `assets`
tables plus the knowledge pack, in pure modules under `src/lib/budget/`
(`mortgage.ts`, `current-budget.ts`, `forecast.ts`). The current budget blends, per category,
committed recurring + amortized maintenance reserve + the trailing-12-month average of actual
expenses that are neither tied to a commitment nor maintenance/repair — so nothing is
double-counted. The forecast walks each active schedule (via `advanceDate`) and places predicted
replacements (via `estimateReplacement`) into the month they fall. The home-purchase scenario is a
standard amortization calculator (PITI, PMI when down payment < 20%, cash-to-close, maintenance
reserve) whose inputs live **only in the URL query string** — bookmarkable, shareable, reload-safe,
and recomputed client-side on every slider move for instant feedback. Confirmed with the owner
(dedicated nav tab; live/URL-based scenarios; the committed+reserve+extras blend).

**Why:** Keeping the feature inside existing tables means zero migration and no new source of truth
to keep in sync. Client-side recompute of pure math gives the iPhone-instant slider feel the
product calls for without any server round-trip. URL-held inputs make rate/price sensitivity easy
to explore and share without building a scenarios table we don't yet need.

**Known limitations:** the forecast assumes today's commitments continue (respecting start/end
dates) and does not model inflation or future new commitments beyond scheduled maintenance and
predicted replacements; property-tax rate and insurance in the scenario are national-ballpark
placeholders, flagged in the UI to be replaced with the household's county rate and a real quote;
scenarios are not saved by name (URL only).

---

## ADR-012 — Make/model/powertrain-aware vehicle knowledge

**Context:** The ADR-010 pack treated every vehicle identically — it suggested an oil change for a
Tesla and keyed replacement cost / residual value only to body style. The owner asked for
suggestions, cost, and residual value specific to the make and model ("my Tesla should not need an
oil change").

**Decision:** Add a **powertrain** axis (`gas`/`hybrid`/`phev`/`electric`) and a **brand-segment
tier** (economy/mainstream/premium/luxury) to the vehicle knowledge, still with **no schema
change**. Powertrain is guessed deterministically by keyword-matching the asset's
`manufacturer` + `model_number` + `name` against a new `data/vehicle-makes.json` table (Tesla →
electric, Prius → hybrid, RAV4 Prime / Volt / Jeep 4xe → plug-in hybrid, Bolt / Leaf / Mach-E /
Rivian → electric, …), overridable via a `details.powertrain` key. Maintenance is now keyed by
powertrain (`vehicle_gas` / `vehicle_hybrid` / `vehicle_electric`): EVs get no oil change and
instead get tire rotation, cabin filter, brake-fluid, 12V-battery, and HV-battery-coolant tasks;
PHEVs share the hybrid schedule (they still have an engine). Replacement cost is the body-style
band scaled by the make's tier multiplier, and electric vehicles use their own steeper
depreciation curve. All values remain editable estimates.

**Why:** Delivers make/model-specific maintenance, cost, and residual value while staying entirely
inside Phase 1's tables and the existing `assets.details` convention — no migration. Keyword
matching mirrors the existing subtype guesser, so it degrades gracefully (unknown make → mainstream
tier + gas) and is always user-overridable.

**Known limitation:** the make/model table is a curated keyword list of common U.S. makes, not an
exhaustive VIN database; per-model cost tables are out of scope. An unrecognized make falls back to
body-style defaults and a gas powertrain, correctable with one tap.

---

## ADR-013 — Explicit Data API grants alongside RLS policies

**Context:** Setting up the e2e test suite (local Supabase via the CLI, per ADR-011's sibling
testing work) surfaced that a fresh local stack — migrations applied, RLS enabled exactly as
ADR-006 describes — still returned "permission denied" for every table to a signed-in user. RLS
policies govern which *rows* a role can see; they don't grant access to the *table* at all. Recent
Supabase CLI versions stopped auto-granting table privileges to `anon`/`authenticated` for new
tables (the `auto_expose_new_tables` flag in `supabase/config.toml`, itself deprecated and slated
for removal), whereas the live hosted project still has the legacy implicit grants from when the
tables were first created there.

**Decision:** Add an explicit, idempotent migration that grants `anon`, `authenticated`, and
`service_role` full privileges on every table/sequence/routine in `public`, plus matching
`ALTER DEFAULT PRIVILEGES` so future tables inherit the same grants. This runs safely against any
environment, including the live project (a re-grant is a no-op there).

**Why:** Table-level GRANTs and RLS policies are two independent gates in Postgres; ADR-006 only
covered the second. Making the first explicit in a migration — rather than leaning on a
CLI config flag Supabase has already marked for removal — keeps local dev, CI, and the live
project's effective permissions identical and durable past that flag's removal date.
