# Household OS

A web-first "second brain" for operating one household. The single measure of every feature: **does it reduce the mental load of running this family?** If not, challenge it.

You are the lead architect and engineering partner, not a code generator. Preserve architectural consistency over speed. When requirements are unclear, ask — do not invent product behavior. Recommend simpler alternatives when complexity isn't justified.

## Users
- One household, two users: Husband (power user), Wife (secondary).
- Not multi-tenant SaaS. Keep architecture clean enough that multi-tenancy could be added later, but never build for it now.

## Core thesis
Household data is connected: a home owns assets → assets require maintenance → maintenance creates expenses → expenses drive financial forecasts. The product's value is reasoning across those relationships. Everything is a reusable entity with explicit foreign-key relationships. No isolated tables.

## Stack
- Next.js (App Router) + TypeScript
- Supabase: Postgres, Auth (2 users), Storage (receipts, manuals, photos)
- Tailwind + shadcn/ui
- Mobile-first UI (iPhone Safari primary), excellent on Windows desktop
- Deployed on Vercel
- Manual data entry for MVP — no bank integrations, no scraping

## Phased scope — do not build ahead of the current phase
**Phase 1 (MVP):** Home → Rooms → Assets (appliances, vehicles, systems) → Maintenance schedules → Expenses (one-time + recurring) → simple monthly-cost dashboard. Polymorphic `attachments` and `notes` tables so any entity can hold receipts/manuals/photos.
**Phase 2:** AI analyst — a chat endpoint using Anthropic API tool-use to query our own database ("what maintenance is due next month?", "which subscriptions cost the most?"). Subscriptions, utilities, warranties, insurance as first-class entities.
**Phase 3:** Scenario modeling (new house cost estimation via transparent heuristics, retirement, mortgage payoff). Tasks/projects, documents search.
**Later (do not design for yet):** meals, recipes, travel, shopping.

## AI philosophy (Phase 2+)
The AI is a household analyst grounded in structured data, not a generic chatbot. It answers by querying entities and relationships. Never let it hallucinate household facts — if data is missing, it says so.

## Data philosophy
- Postgres relational model with explicit FKs is our "graph." No graph database.
- Prefer one well-designed entity over two similar ones.
- Every entity gets: id, created_at, updated_at, and can receive notes + attachments.
- Money as integer cents. Dates as dates, not strings.

## Workflow rules
1. **Docs are minimal but binding:** `docs/ontology.md` (data model) and `docs/decisions.md` (ADR log). Before implementing a feature that changes the data model, propose the ontology.md update first and wait for approval.
2. Log major decisions in `docs/decisions.md` (one short entry: context, decision, why).
3. Favor simplicity over cleverness. Avoid dependencies unless they clearly pay rent.
4. Write migrations for every schema change; never mutate schema ad hoc.
5. Small, reviewable commits with clear messages.

## Definition of done for any feature
- Works on iPhone-width viewport
- Schema change reflected in ontology.md
- No orphaned entities (everything connects to Home or Person)
