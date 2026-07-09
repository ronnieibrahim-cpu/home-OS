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
- **Always verify before pushing:** `npm run build` and `npm run lint` must pass (the build runs
  the TypeScript check too). **Never push a red build** — it takes the live app down.
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

## Common commands

```bash
npm install        # first time
npm run dev        # local dev at http://localhost:3000
npm run build      # production build + TypeScript check (run before every push)
npm run lint       # eslint (run before every push)
```
