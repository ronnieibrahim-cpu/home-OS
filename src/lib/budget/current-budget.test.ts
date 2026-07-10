import { describe, expect, it } from "vitest";
import { amortizeToMonthlyCents, buildCurrentBudget } from "./current-budget";
import type { Expense, MaintenanceSchedule, RecurringExpense } from "@/lib/types";

const ASOF = "2026-07-10";

function recurring(overrides: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: "re-" + Math.random(),
    household_id: "h1",
    home_id: null,
    asset_id: null,
    name: "Commitment",
    category: "other",
    amount_cents: 0,
    interval_value: 1,
    interval_unit: "month",
    starts_on: "2020-01-01",
    ends_on: null,
    ...overrides,
  };
}

function schedule(overrides: Partial<MaintenanceSchedule>): MaintenanceSchedule {
  return {
    id: "ms-" + Math.random(),
    asset_id: "a1",
    name: "Task",
    description: null,
    interval_value: 1,
    interval_unit: "month",
    next_due_on: null,
    estimated_cost_cents: null,
    is_active: true,
    ...overrides,
  };
}

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: "e-" + Math.random(),
    household_id: "h1",
    home_id: null,
    asset_id: null,
    recurring_expense_id: null,
    description: "Expense",
    category: "other",
    amount_cents: 0,
    incurred_on: ASOF,
    ...overrides,
  };
}

describe("amortizeToMonthlyCents", () => {
  it("spreads a one-off cost across a month-based interval", () => {
    expect(amortizeToMonthlyCents(6000, 3, "month")).toBe(2000);
  });

  it("spreads a one-off cost across a year-based interval", () => {
    expect(amortizeToMonthlyCents(120000, 1, "year")).toBe(10000);
  });

  it("returns 0 for a non-positive interval (guards divide-by-zero)", () => {
    expect(amortizeToMonthlyCents(6000, 0, "month")).toBe(0);
  });
});

describe("buildCurrentBudget", () => {
  it("blends committed + reserve + extras per category with no double-counting", () => {
    const budget = buildCurrentBudget({
      recurring: [
        recurring({ category: "mortgage", amount_cents: 200000, interval_value: 1, interval_unit: "month" }),
        recurring({ category: "utility", amount_cents: 15000, interval_value: 1, interval_unit: "month" }),
        // $120/yr -> $10/mo
        recurring({ category: "subscription", amount_cents: 12000, interval_value: 1, interval_unit: "year" }),
        // inactive: ended before asOf -> excluded
        recurring({
          category: "service",
          amount_cents: 99999,
          starts_on: "2019-01-01",
          ends_on: "2020-01-01",
        }),
        // not yet started -> excluded
        recurring({ category: "service", amount_cents: 99999, starts_on: "2030-01-01" }),
      ],
      schedules: [
        schedule({ estimated_cost_cents: 6000, interval_value: 3, interval_unit: "month" }), // -> 2000/mo
        schedule({ estimated_cost_cents: 24000, interval_value: 6, interval_unit: "month" }), // -> 4000/mo
        schedule({ estimated_cost_cents: 5000, is_active: false }), // inactive -> excluded
        schedule({ estimated_cost_cents: null }), // no cost -> excluded
      ],
      expenses: [
        // extras: not tied to a commitment, not maintenance/repair, in window
        expense({ category: "purchase", amount_cents: 120000, incurred_on: "2026-01-15" }),
        expense({ category: "purchase", amount_cents: 60000, incurred_on: "2025-08-01" }),
        // maintenance/repair actuals are excluded from extras (reserve already covers them)
        expense({ category: "maintenance", amount_cents: 50000, incurred_on: "2026-02-01" }),
        expense({ category: "repair", amount_cents: 30000, incurred_on: "2026-02-01" }),
        // tied to a recurring commitment -> excluded from extras (would double-count)
        expense({
          category: "utility",
          amount_cents: 15000,
          incurred_on: "2026-03-01",
          recurring_expense_id: "some-recurring-id",
        }),
        // outside the trailing window -> excluded
        expense({ category: "other", amount_cents: 99999, incurred_on: "2024-01-01" }),
        // on the asOf boundary -> included
        expense({ category: "other", amount_cents: 1200, incurred_on: ASOF }),
      ],
      asOfISO: ASOF,
      actualsMonths: 12,
    });

    const byCategory = Object.fromEntries(budget.lines.map((l) => [l.category, l]));

    expect(byCategory.mortgage).toEqual({
      category: "mortgage",
      committedCents: 200000,
      reserveCents: 0,
      extrasCents: 0,
      totalCents: 200000,
    });
    expect(byCategory.utility).toEqual({
      category: "utility",
      committedCents: 15000,
      reserveCents: 0,
      extrasCents: 0,
      totalCents: 15000,
    });
    expect(byCategory.subscription).toEqual({
      category: "subscription",
      committedCents: 1000,
      reserveCents: 0,
      extrasCents: 0,
      totalCents: 1000,
    });
    expect(byCategory.maintenance).toEqual({
      category: "maintenance",
      committedCents: 0,
      reserveCents: 6000,
      extrasCents: 0,
      totalCents: 6000,
    });
    // (120000 + 60000) / 12 = 15000
    expect(byCategory.purchase).toEqual({
      category: "purchase",
      committedCents: 0,
      reserveCents: 0,
      extrasCents: 15000,
      totalCents: 15000,
    });
    // 1200 / 12 = 100
    expect(byCategory.other).toEqual({
      category: "other",
      committedCents: 0,
      reserveCents: 0,
      extrasCents: 100,
      totalCents: 100,
    });

    // No stray categories from the excluded (inactive/future/tied/out-of-window) rows.
    expect(Object.keys(byCategory).sort()).toEqual(
      ["mortgage", "utility", "subscription", "maintenance", "purchase", "other"].sort()
    );

    expect(budget.committedTotalCents).toBe(216000);
    expect(budget.reserveTotalCents).toBe(6000);
    expect(budget.extrasTotalCents).toBe(15100);
    expect(budget.totalCents).toBe(237100);
    expect(budget.housingCommittedCents).toBe(200000);
    expect(budget.actualsMonths).toBe(12);
  });

  it("sorts lines high to low by total, ties broken by first-seen order", () => {
    const budget = buildCurrentBudget({
      recurring: [
        recurring({ category: "mortgage", amount_cents: 200000 }),
        recurring({ category: "utility", amount_cents: 15000 }),
      ],
      schedules: [],
      expenses: [
        expense({ category: "purchase", amount_cents: 180000, incurred_on: "2026-01-01" }),
      ],
      asOfISO: ASOF,
      actualsMonths: 12,
    });

    // utility (15000 committed) and purchase (180000/12 = 15000 extras) tie;
    // utility was seen first (via `recurring`), so it sorts first among ties.
    expect(budget.lines.map((l) => l.category)).toEqual(["mortgage", "utility", "purchase"]);
  });

  it("a committed mortgage with no matching schedule/expenses still reports housingCommittedCents", () => {
    const budget = buildCurrentBudget({
      recurring: [recurring({ category: "mortgage", amount_cents: 250000 })],
      schedules: [],
      expenses: [],
      asOfISO: ASOF,
    });
    expect(budget.housingCommittedCents).toBe(250000);
    expect(budget.totalCents).toBe(250000);
  });

  it("reports housingCommittedCents as 0 when there is no mortgage commitment", () => {
    const budget = buildCurrentBudget({
      recurring: [recurring({ category: "utility", amount_cents: 5000 })],
      schedules: [],
      expenses: [],
      asOfISO: ASOF,
    });
    expect(budget.housingCommittedCents).toBe(0);
  });

  it("respects starts_on/ends_on boundaries inclusively", () => {
    const budget = buildCurrentBudget({
      recurring: [
        recurring({ category: "service", amount_cents: 1000, starts_on: ASOF, ends_on: null }),
        recurring({ category: "tax", amount_cents: 2000, starts_on: "2020-01-01", ends_on: ASOF }),
      ],
      schedules: [],
      expenses: [],
      asOfISO: ASOF,
    });
    const byCategory = Object.fromEntries(budget.lines.map((l) => [l.category, l.committedCents]));
    expect(byCategory.service).toBe(1000);
    expect(byCategory.tax).toBe(2000);
  });
});
