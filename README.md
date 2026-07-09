# Household OS

A web-first "second brain" for operating our household. See `CLAUDE home os.md` for the
product vision and `docs/ontology.md` for the data model.

**Stack:** Next.js (App Router) + TypeScript · Supabase (Postgres, Auth, Storage) ·
Tailwind + shadcn/ui · mobile-first (iPhone Safari primary).

## What's in it (Phase 1)

- **Home → Rooms → Assets** — track appliances, vehicles, systems, and house parts, each with
  photos, receipts, and manuals.
- **Maintenance schedules** — recurring upkeep on any asset ("replace filter every 3 months").
  Tap **Done** and the next-due date advances and a service log is recorded.
- **Money** — recurring commitments (mortgage, utilities, insurance, subscriptions) and one-time
  expenses, each optionally attached to the home or asset it's for.
- **Dashboard** (the home screen) — your recurring **cost of living per month** and the
  **upcoming maintenance** across every asset, with overdue items flagged.

The money and maintenance screens use **optimistic updates**: a tap changes the screen
immediately and syncs to Supabase in the background, so it feels instant on an iPhone.

## First-time setup

You need a free Supabase project and about 10 minutes.

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → sign in → **New project**.
2. Name it (e.g. `household-os`), pick a strong database password (save it somewhere), choose
   a region near you, and create it.

### 2. Run the database migrations

In the Supabase dashboard, open **SQL Editor** and run the five files in
`supabase/migrations/` **in order** (open each file, paste its contents, click Run):

1. `20260708000001_foundation.sql`
2. `20260708000002_property.sql`
3. `20260708000003_operations.sql`
4. `20260708000004_knowledge.sql`
5. `20260708000005_security.sql`

(If you use the Supabase CLI instead: `supabase link --project-ref YOUR_REF` then
`supabase db push`.)

### 3. Create the two user accounts

In the dashboard: **Authentication → Users → Add user → Create new user**.

- Enter your email + a password, and check **Auto Confirm User**.
- Repeat for your wife's email.

There is deliberately no sign-up page in the app — only these accounts can log in.

### 4. Put your keys in `.env.local`

1. In the dashboard: **Project Settings → API Keys** (URL is under **Data API**).
2. Copy `.env.local.example` to `.env.local` in the project root.
3. Fill in the two values:
   - `NEXT_PUBLIC_SUPABASE_URL` — the **Project URL** (looks like `https://abcd1234.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the **anon / public** key (a long string; NOT the
     `service_role` key — that one must never go in a browser app)

`.env.local` is gitignored, so your keys stay on your machine.

### 5. Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in. On first login the app
creates the household record automatically.

To use it from your iPhone on the same Wi-Fi: run `npm run dev -- -H 0.0.0.0` and open
`http://YOUR-COMPUTER-IP:3000` in Safari.

## Deploy it (use it anywhere on your iPhone)

To run it at a real URL — not just on your home Wi-Fi — deploy to Vercel from this GitHub repo.
Step-by-step (import the repo, set the two Supabase env vars, point Supabase auth at the live
URL, Add to Home Screen) is in **[`docs/deployment.md`](docs/deployment.md)**. After the first
setup, every push to `main` redeploys automatically.

## Development workflow

- Docs are binding: propose changes to `docs/ontology.md` before schema changes.
- Every schema change is a migration in `supabase/migrations/` — never mutate the database ad hoc.
- Log major decisions in `docs/decisions.md`.
