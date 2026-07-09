# Deploying Household OS to Vercel

Goal: your household app running at a real URL you can open (and "Add to Home Screen") on your
iPhone from anywhere. This assumes you've already finished **First-time setup** in `README.md`
(Supabase project created, migrations run, the two user accounts made).

You'll do this once. After that, every `git push` to `main` redeploys automatically.

---

## What you need

- Your code pushed to GitHub (this repo).
- Your two Supabase values from `README.md` step 4:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`  *(the **anon/public** key — never the `service_role` key)*

---

## Step 1 — Sign in to Vercel with GitHub

1. Go to [vercel.com](https://vercel.com) → **Sign Up** / **Log In**.
2. Choose **Continue with GitHub** and authorize Vercel. Using the same GitHub account that owns
   this repo makes the next step one click.

## Step 2 — Import the repository

1. In the Vercel dashboard: **Add New… → Project**.
2. Under **Import Git Repository**, find this repo (`home-os`). If you don't see it, click
   **Adjust GitHub App Permissions** / **Configure** and grant Vercel access to the repo, then
   come back.
3. Click **Import**.

## Step 3 — Configure the project

Vercel auto-detects Next.js, so the defaults are correct:

- **Framework Preset:** Next.js
- **Build Command:** `next build` (default)
- **Output:** managed by the framework preset
- **Root Directory:** `./` (leave as-is)

Do **not** deploy yet — add the environment variables first (next step). If you already clicked
Deploy, that's fine; add the variables in Step 4 and then **Redeploy**.

## Step 4 — Add the Supabase environment variables

In the import screen (or later under **Project → Settings → Environment Variables**), add both:

| Name | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon/public key | Production, Preview, Development |

Tick all three environment checkboxes for each so preview deployments work too. These are the
**same two values** from your local `.env.local`.

> Why this is safe: the anon key is designed to be public, and Row Level Security (ADR-006) means
> it can only read/write for a signed-in user. The `service_role` key must **never** be added
> here — it bypasses RLS.

## Step 5 — Deploy

Click **Deploy**. First build takes ~1–2 minutes. When it's done Vercel shows a URL like
`https://home-os-xxxx.vercel.app`.

## Step 6 — Point Supabase at the live URL

So auth redirects work on the deployed site:

1. Supabase dashboard → **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel URL (`https://home-os-xxxx.vercel.app`).
3. Add the same URL under **Redirect URLs** and **Save**.

## Step 7 — Open it on your iPhone

1. In Safari, go to your Vercel URL and sign in with one of the accounts you created.
2. Tap the **Share** icon → **Add to Home Screen**. You now have an app icon that opens
   full-screen — it behaves like a native app.

---

## After the first deploy

- **Every push to `main` auto-deploys.** Pull requests get their own preview URL.
- **Changing keys / rotating Supabase:** update the env vars in Vercel → **Redeploy** (env
  changes don't take effect until the next deploy).
- **Custom domain (optional):** Vercel → **Project → Settings → Domains**. If you add one,
  update the Supabase **Site URL / Redirect URLs** to match.

## Troubleshooting

- **Build fails with "supabaseUrl is required":** the env vars aren't set (or not ticked for the
  Production environment). Add them and redeploy.
- **Login succeeds locally but not on Vercel:** the Supabase **Site URL / Redirect URLs** still
  point at `localhost`. Fix them in Step 6.
- **Blank data after deploy:** confirm you ran all five migrations and created the user accounts
  in the same Supabase project whose keys you gave Vercel.
