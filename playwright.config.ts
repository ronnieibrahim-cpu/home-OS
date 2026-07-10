import { defineConfig, devices } from "@playwright/test";
import {
  LOCAL_SUPABASE_URL,
  LOCAL_SUPABASE_ANON_KEY,
  APP_PORT,
  APP_URL,
} from "./e2e/local-supabase.mjs";

// Runs against a local `next dev` server backed by the LOCAL Supabase Docker
// stack only (never the live app/project) — see README/CLAUDE.md and
// `npm run test:e2e` (scripts/e2e-setup.mjs resets + seeds that stack first).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "iPhone 15",
      // devices["iPhone 15"] defaults to WebKit; we pin Chromium instead so
      // the suite only needs `npx playwright install chromium` (no WebKit
      // system deps) while keeping the same viewport/UA/touch emulation.
      use: {
        ...devices["iPhone 15"],
        browserName: "chromium",
        // Optional pinned binary (e.g. a preinstalled/cached Chromium in a
        // sandboxed CI image) — unset in normal dev, where Playwright's own
        // downloaded browser is used.
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${APP_PORT}`,
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Overrides whatever is in .env.local so the dev server under test
      // always points at the local Supabase stack, never the live project.
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_SUPABASE_ANON_KEY,
    },
  },
});
