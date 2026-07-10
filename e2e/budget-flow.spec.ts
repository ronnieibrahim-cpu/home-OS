import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "./local-supabase.mjs";

// Full golden-path flow against the local Supabase stack (see
// scripts/e2e-setup.mjs — never the live app/project): sign in, create a
// home/room/asset, accept a suggested maintenance schedule, log an expense,
// then verify all three /budget views render the headline math we can
// hand-compute from exactly what this test just created.
//
// Expected numbers, worked by hand from src/lib/budget/*:
//   Home: price $500,000.00 -> seedPriceCents = 50,000,000.
//   Accepted suggestion "Flush tank (sediment drain)": $0-$150 range -> mid
//     $75.00 (7,500c), interval 1 year -> amortized reserve = round(7500/12)
//     = 625c ($6.25/mo), category "maintenance".
//   Logged expense: $45.00 "purchase" category, not tied to a commitment,
//     not maintenance/repair -> extras = round(4500/12) = 375c ($3.75/mo).
//   No recurring commitments created -> committedTotalCents = 0.
//   Current budget total = 0 + 625 + 375 = 1,000c = $10.00/mo.
//   Forecast (24mo): the schedule's first occurrence lands exactly 12
//     months out (within the horizon); the second lands 24 months out
//     (bucket index 24, outside the 0-23 window) -> forecast total =
//     7,500c ($75.00), average = round(7500/24) = 313c ($3.13/mo).
//   Home purchase (20% down, no PMI, no equity, no existing mortgage):
//     loan 40,000,000c; P&I 252,827c; tax 45,833c; insurance 15,000c;
//     PITI 313,660c; reserve 41,667c; total monthly 385,327c ($3,853.27);
//     closing costs 1,500,000c; cash to close 11,500,000c ($115,000.00);
//     after purchase = 1,000 - 0 + 385,327 = 386,327c ($3,863.27),
//     delta = +385,327c ($3,853.27/mo vs. today).

test("login, build a household, and see correct budget math across all three views", async ({
  page,
}) => {
  await test.step("sign in", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_TEST_USER.email);
    await page.getByLabel("Password").fill(E2E_TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Start with your home")).toBeVisible();
  });

  await test.step("create a home", async () => {
    await page.getByRole("link", { name: "Add your home" }).click();
    await expect(page).toHaveURL("/homes/new");
    await page.getByLabel("Name *").fill("Test Home");
    await page.getByLabel("Purchase price ($)").fill("500000.00");
    await page.getByRole("button", { name: "Add home" }).click();
    await expect(page).toHaveURL(/\/homes\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Test Home" })).toBeVisible();
  });

  await test.step("create a room", async () => {
    await page.getByRole("link", { name: "Add room" }).click();
    await page.getByLabel("Name *").fill("Utility Room");
    await page.getByRole("button", { name: "Add room" }).click();
    await expect(page.getByText("Utility Room")).toBeVisible();
  });

  await test.step("create an asset in the room", async () => {
    await page.getByRole("link", { name: "Utility Room" }).click();
    await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]+$/);
    // Scoped to <main> — the bottom tab bar also has a nav link named "Add".
    await page.getByRole("main").getByRole("link", { name: "Add" }).click();
    await expect(page).toHaveURL(/\/assets\/new/);

    await page.getByLabel("Name *").fill("Water heater");
    await page.getByLabel("Category").selectOption("system");
    await page.getByRole("button", { name: "Add asset" }).click();
    await expect(page).toHaveURL(/\/assets\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Water heater" })).toBeVisible();
  });

  await test.step("accept a suggested maintenance schedule", async () => {
    await expect(page.getByText("Suggested maintenance")).toBeVisible();
    await expect(page.getByText("Flush tank (sediment drain)")).toBeVisible();
    // The suggestion list follows the knowledge pack's JSON order, so the
    // first exact-"Add" button belongs to "Flush tank (sediment drain)".
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await page.waitForLoadState("networkidle");

    // Accepting moves it from "Suggested maintenance" into the asset's real
    // "Maintenance" schedule list — check it landed there, rather than
    // expecting the name to vanish from the page (it's now shown there
    // instead).
    const maintenanceSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Maintenance", exact: true }),
    });
    await expect(maintenanceSection.getByText("Flush tank (sediment drain)")).toBeVisible();
  });

  await test.step("log an expense", async () => {
    await page.goto("/expenses");
    await page.getByRole("button", { name: "Log expense" }).click();
    await page.getByLabel("What was it *").fill("Light bulbs");
    await page.getByLabel("Amount ($) *").fill("45.00");
    await page.getByRole("button", { name: "Add expense" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Light bulbs")).toBeVisible();
  });

  await page.goto("/budget");

  await test.step("This month view has correct headline math", async () => {
    await expect(page.getByText("Projected monthly budget")).toBeVisible();
    await expect(page.getByText("$10.00", { exact: false })).toBeVisible();
    await expect(
      page.getByText("Committed $0.00 · maintenance reserve $6.25 · variable extras $3.75")
    ).toBeVisible();

    const maintenanceLine = page.locator("div", { hasText: /^maintenance\$6\.25\/mo$/ });
    await expect(maintenanceLine.first()).toBeVisible();
    const purchaseLine = page.locator("div", { hasText: /^purchase\$3\.75\/mo$/ });
    await expect(purchaseLine.first()).toBeVisible();
  });

  await test.step("Forecast view has correct headline math", async () => {
    await page.getByRole("button", { name: "Forecast" }).click();
    // Stat renders label and value as sibling <p>s — walk from the label to
    // avoid matching the (coincidentally equal) "Big upcoming hits" amount.
    const nextMonthsValue = page
      .getByText("Next 24 months", { exact: true })
      .locator("xpath=following-sibling::p[1]");
    await expect(nextMonthsValue).toHaveText("$75.00");
    const avgValue = page
      .getByText("Average / month", { exact: true })
      .locator("xpath=following-sibling::p[1]");
    await expect(avgValue).toHaveText("$3.13");
  });

  await test.step("Home purchase view has correct headline math", async () => {
    await page.getByRole("button", { name: "Home purchase" }).click();
    await expect(page.getByText("Total monthly cost of ownership")).toBeVisible();
    await expect(page.getByText("$3,853.27", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("$500,000.00 · 20% down · 6.50% · 30yr")).toBeVisible();

    await expect(page.getByText("$2,528.27").first()).toBeVisible(); // Principal & interest
    await expect(page.getByText("$458.33").first()).toBeVisible(); // Property tax
    await expect(page.getByText("$150.00").first()).toBeVisible(); // Insurance
    // PITI subtotal — also coincidentally matches the sensitivity grid's
    // "current price/rate" cell (same PITI+PMI, PMI is 0 here), hence first().
    await expect(page.getByText("$3,136.60").first()).toBeVisible();
    await expect(page.getByText("$300.00").first()).toBeVisible(); // Utilities (est.)
    await expect(page.getByText("$416.67").first()).toBeVisible(); // Maintenance reserve
    // No PMI row: 20% down.
    await expect(page.getByText("PMI (under 20% down)")).toHaveCount(0);

    await expect(page.getByText("Cash needed at closing")).toBeVisible();
    await expect(page.getByText("$115,000.00").first()).toBeVisible();
    await expect(
      page.getByText("Down payment $100,000.00 + closing costs $15,000.00")
    ).toBeVisible();

    await expect(page.getByText("$3,863.27/mo").first()).toBeVisible(); // After purchase
    await expect(page.getByText("+$3,853.27/mo vs. today")).toBeVisible();
  });
});
