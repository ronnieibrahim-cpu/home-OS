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
