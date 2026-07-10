#!/usr/bin/env node
// Boots the LOCAL Supabase stack (Docker, via the Supabase CLI), resets it to
// a clean schema, and creates the one auth user the e2e suite logs in as.
// Never touches the live/hosted Supabase project — see e2e/local-supabase.mjs
// for the fixed local-only connection details this relies on.

import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  LOCAL_SUPABASE_URL,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  E2E_TEST_USER,
} from "../e2e/local-supabase.mjs";

function run(args) {
  console.log(`[e2e-setup] $ npx ${args.join(" ")}`);
  execFileSync("npx", args, { stdio: "inherit" });
}

run(["--yes", "supabase", "start"]);
// Fresh schema + data on every run so tests never depend on leftover state.
run(["--yes", "supabase", "db", "reset"]);

const admin = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `db reset` restarts the auth container; Kong (the local API gateway) can
// briefly hold a stale DNS entry for it right after, returning 502s. Retry
// instead of failing the whole setup on that transient race.
let lastError;
for (let attempt = 1; attempt <= 5; attempt++) {
  const { error } = await admin.auth.admin.createUser({
    email: E2E_TEST_USER.email,
    password: E2E_TEST_USER.password,
    email_confirm: true,
  });
  if (!error) {
    lastError = null;
    break;
  }
  lastError = error;
  console.warn(`[e2e-setup] createUser attempt ${attempt} failed (${error.message}), retrying...`);
  await sleep(2000 * attempt);
}

if (lastError) {
  console.error("[e2e-setup] failed to create the e2e test user:", lastError.message);
  process.exit(1);
}

console.log(`[e2e-setup] ready — test user ${E2E_TEST_USER.email} created on the local stack.`);
