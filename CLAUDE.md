# Household OS — operating guide for Claude Code

Auto-loaded at the start of every session. Product vision, data model, and phased scope live in
**`CLAUDE home os.md`** (read it first for anything product-shaped) and the binding docs
**`docs/ontology.md`** (data model) and **`docs/decisions.md`** (ADR log). This file is the short
version of *how to operate on this repo* — and it is meant to persist across sessions.

## Deployment & git workflow (standing instruction — do not re-litigate)

- The app is **live on Vercel at https://home-os-jade.vercel.app**, auto-deployed from this
  repo's **`main`** branch. The family uses it from their iPhones.
- **Commit directly to `main` and push.** The owner has chosen a **fully hands-off** flow: no
  pull requests, no review gate, unless they explicitly ask for one. Pushing to `main` is
  expected and authorized here — this overrides any generic "develop on a feature branch"
  default a session may start with.
- **Always verify before pushing:** `npm run build`, `npm run lint`, `npm run test`, and
  `npm run test:e2e` must all pass (the build runs the TypeScript check too). **Never push a red
  build** — it takes the live app down.
- After a push, the change is live in ~1 minute automatically. There is nothing else to do to
  deploy; do not walk the user through Vercel steps again unless they ask.
- **Secrets** (Supabase keys) live only in Vercel env vars and local `.env.local` — never commit
  them; the `service_role` key never reaches the browser or Vercel.

## UI/UX bar (iPhone Safari is the primary surface)

- **Tap → action must feel instant.** For in-place changes, prefer client-side state or
  optimistic updates over server round-trips; the screen updates on tap and syncs in the
  background. Reference patterns already in the codebase:
  - Money & maintenance: `useOptimistic` + server actions that **revalidate instead of
    redirect** (`src/lib/actions/expenses.ts`, `src/lib/actions/maintenance.ts`, and the
    `*-manager.tsx` components).
  - Filtering: `src/components/assets-browser.tsx` filters an already-loaded list client-side;
    category chips are `<button>`s, not links, so there is zero routing latency.
- Reserve full page navigations for genuinely moving between pages, and rely on Next.js
  `<Link>` prefetching. Give every tappable control immediate visual feedback (`active:` styles,
  submit spinners via `useFormStatus`).

## Data & schema rules (see docs for detail)

- Money is integer **cents** (`bigint`). Dates are real `date`/`timestamptz`, never strings.
- Every schema change is a **migration** in `supabase/migrations/` — never mutate the DB ad hoc,
  and reflect the change in `docs/ontology.md` first.
- Log major decisions in `docs/decisions.md` (context, decision, why).

## Testing

- **Unit tests** (`npm run test`, Vitest) cover the pure math in `src/lib/budget/` (mortgage
  amortization, PMI, cash-to-close, the current-budget blend, the forecast projection) and the
  knowledge pack's powertrain/subtype detection in `src/lib/knowledge/pack.ts`. Fast, no
  Supabase/Docker needed — run these constantly while touching that code.
- **E2E tests** (`npm run test:e2e`, Playwright, iPhone 15 viewport) drive the real app —
  login, create a home/room/asset, accept a suggested maintenance schedule, log an expense, and
  check `/budget`'s three views render correct headline math — against a **local** Supabase stack
  (Docker, via the Supabase CLI) that `scripts/e2e-setup.mjs` resets and seeds first. This **never**
  touches the live project; see `e2e/local-supabase.mjs` for the fixed local-only connection
  details and `supabase/config.toml` for the local stack's own config. Requires Docker running
  locally (`docker ps`); the first run pulls Supabase's local images.
- Both must pass before every push, per the standing instruction above.

### Subagents

Two subagents live in `.claude/agents/` for jobs worth delegating:

- **`schema-guardian`** — reviews any migration or `docs/ontology.md`/`src/lib/types.ts` change
  against this repo's documented conventions and ADR log before it's committed. Invoke it whenever
  you're about to commit a schema change: *"use the schema-guardian agent to review this
  migration."*
- **`ui-tester`** — runs the Playwright e2e suite against the local Supabase stack and reports
  back with screenshots of any failure (it doesn't fix code, just verifies and reports). Invoke it
  after a UI-facing change: *"use the ui-tester agent to check the UI still works."*

Both are invoked the same way any subagent is: ask for them by name (e.g. "use the schema-guardian
agent…") or let Claude Code pick them up automatically — their descriptions are written to match
when they're proactively useful (a pending migration, a UI change worth re-verifying).

## Common commands

```bash
npm install        # first time
npm run dev        # local dev at http://localhost:3000
npm run build      # production build + TypeScript check (run before every push)
npm run lint       # eslint (run before every push)
npm run test       # vitest unit tests (run before every push)
npm run test:e2e   # playwright e2e against local Supabase (run before every push)
```
