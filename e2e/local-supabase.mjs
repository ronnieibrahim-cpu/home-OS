// Fixed connection details for the LOCAL Supabase stack started by
// `supabase start` (see supabase/config.toml). These are Supabase's
// well-known local-development defaults — deterministic from the fixed
// local JWT secret, meaningless outside 127.0.0.1, and never the live
// project's keys. Shared by playwright.config.ts and scripts/e2e-setup.mjs
// so the two can't drift.

export const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

export const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const E2E_TEST_USER = {
  email: "e2e@household.test",
  password: "Test-Password-1234!",
};

export const APP_PORT = 3100;
export const APP_URL = `http://127.0.0.1:${APP_PORT}`;
