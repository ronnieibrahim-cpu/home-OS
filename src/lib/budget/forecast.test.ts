import { describe, expect, it } from "vitest";
import { projectForecast } from "./forecast";
import type { Asset, MaintenanceSchedule, RecurringExpense } from "@/lib/types";

const ASOF = "2026-07-10"; // horizon (months=6) => Jul, Aug, Sep, Oct, Nov, Dec 2026

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

type AssetInput = Pick<
  Asset,
  "name" | "category" | "manufacturer" | "model_number" | "details" | "purchase_date" | "status"
>;

function asset(overrides: Partial<AssetInput>): AssetInput {
  return {
    name: "Thing",
    category: "other",
    manufacturer: null,
    model_number: null,
    details: null,
    purchase_date: null,
    status: "active",
    ...overrides,
  };
}

describe("projectForecast — recurring commitments", () => {
  it("smooths a recurring commitment into every active month, respecting starts_on/ends_on", () => {
    const forecast = projectForecast({
      recurring: [
        // $1,200/yr, always active -> $100/mo in every bucket
        recurring({ amount_cents: 120000, interval_value: 1, interval_unit: "year" }),
        // $300/mo, only active Sep-Oct 2026
        recurring({
          amount_cents: 30000,
          interval_value: 1,
          interval_unit: "month",
          starts_on: "2026-09-01",
          ends_on: "2026-10-31",
        }),
      ],
      schedules: [],
      assets: [],
      asOfISO: ASOF,
      months: 6,
    });

    const byMonth = Object.fromEntries(forecast.months.map((m) => [m.monthISO, m.recurringCents]));
    expect(byMonth["2026-07-01"]).toBe(10000);
    expect(byMonth["2026-08-01"]).toBe(10000);
    expect(byMonth["2026-09-01"]).toBe(40000); // 10000 + 30000
    expect(byMonth["2026-10-01"]).toBe(40000);
    expect(byMonth["2026-11-01"]).toBe(10000); // ended before Nov
    expect(byMonth["2026-12-01"]).toBe(10000);
  });
});

describe("projectForecast — scheduled maintenance", () => {
  it("drops future occurrences into the month they fall due, walking the interval forward", () => {
    const forecast = projectForecast({
      recurring: [],
      schedules: [
        schedule({
          name: "Filter change",
          next_due_on: "2026-08-15",
          interval_value: 3,
          interval_unit: "month",
          estimated_cost_cents: 9000,
        }),
      ],
      assets: [],
      asOfISO: ASOF,
      months: 6,
    });

    const byMonth = Object.fromEntries(forecast.months.map((m) => [m.monthISO, m.maintenanceCents]));
    expect(byMonth["2026-07-01"]).toBe(0);
    expect(byMonth["2026-08-01"]).toBe(9000); // next_due_on
    expect(byMonth["2026-09-01"]).toBe(0);
    expect(byMonth["2026-10-01"]).toBe(0);
    expect(byMonth["2026-11-01"]).toBe(9000); // +3 months
    expect(byMonth["2026-12-01"]).toBe(0);
  });

  it("counts an overdue schedule once in the first month, then resumes its regular cadence", () => {
    const forecast = projectForecast({
      recurring: [],
      schedules: [
        schedule({
          name: "Gutter cleaning",
          next_due_on: "2025-10-05", // overdue relative to the Jul 2026 horizon start
          interval_value: 6,
          interval_unit: "month",
          estimated_cost_cents: 7000,
        }),
      ],
      assets: [],
      asOfISO: ASOF,
      months: 6,
    });

    const byMonth = Object.fromEntries(forecast.months.map((m) => [m.monthISO, m.maintenanceCents]));
    expect(byMonth["2026-07-01"]).toBe(7000); // overdue catch-up, dumped into the first month
    expect(byMonth["2026-08-01"]).toBe(0);
    expect(byMonth["2026-09-01"]).toBe(0);
    expect(byMonth["2026-10-01"]).toBe(7000); // next regular occurrence, 6mo after Apr 2026
    expect(byMonth["2026-11-01"]).toBe(0);
    expect(byMonth["2026-12-01"]).toBe(0);
  });

  it("ignores inactive schedules, schedules with no due date, and schedules with no cost", () => {
    const forecast = projectForecast({
      recurring: [],
      schedules: [
        schedule({ next_due_on: "2026-08-01", estimated_cost_cents: 5000, is_active: false }),
        schedule({ next_due_on: null, estimated_cost_cents: 5000 }),
        schedule({ next_due_on: "2026-08-01", estimated_cost_cents: null }),
        schedule({ next_due_on: "2026-08-01", estimated_cost_cents: 0 }),
      ],
      assets: [],
      asOfISO: ASOF,
      months: 6,
    });

    expect(forecast.totalCents).toBe(0);
    expect(forecast.months.every((m) => m.events.length === 0)).toBe(true);
  });
});

describe("projectForecast — predicted replacements", () => {
  it("places a replacement spike in the overridden year/month at the overridden cost", () => {
    const forecast = projectForecast({
      recurring: [],
      schedules: [],
      assets: [
        asset({
          name: "Water heater",
          category: "system",
          purchase_date: "2010-09-12", // month = September
          details: {
            replacement_year_override: 2026,
            replacement_cost_cents_override: 500000,
          },
        }),
      ],
      asOfISO: ASOF,
      months: 6,
    });

    const byMonth = Object.fromEntries(forecast.months.map((m) => [m.monthISO, m.replacementCents]));
    expect(byMonth["2026-09-01"]).toBe(500000);
    expect(byMonth["2026-07-01"]).toBe(0);
    expect(byMonth["2026-08-01"]).toBe(0);
    expect(byMonth["2026-10-01"]).toBe(0);

    const sept = forecast.months.find((m) => m.monthISO === "2026-09-01")!;
    expect(sept.events).toEqual([
      { kind: "replacement", label: "Replace Water heater", amountCents: 500000, assetName: "Water heater" },
    ]);
  });

  it("defaults to June when the asset has no purchase date", () => {
    const forecast = projectForecast({
      recurring: [],
      schedules: [],
      assets: [
        asset({
          name: "Dishwasher",
          category: "appliance",
          purchase_date: null,
          details: {
            replacement_year_override: 2027,
            replacement_cost_cents_override: 80000,
          },
        }),
      ],
      asOfISO: ASOF,
      months: 24,
    });

    const june = forecast.months.find((m) => m.monthISO === "2027-06-01");
    expect(june?.replacementCents).toBe(80000);
  });

  it("excludes disposed assets even if their estimate would otherwise land in the window", () => {
    const forecast = projectForecast({
      recurring: [],
      schedules: [],
      assets: [
        asset({
          name: "Water heater",
          category: "system",
          status: "disposed",
          purchase_date: "2010-09-12",
          details: { replacement_year_override: 2026, replacement_cost_cents_override: 500000 },
        }),
      ],
      asOfISO: ASOF,
      months: 6,
    });
    expect(forecast.totalCents).toBe(0);
  });

  it("omits a replacement whose estimated year falls outside the forecast horizon", () => {
    const forecast = projectForecast({
      recurring: [],
      schedules: [],
      assets: [
        asset({
          name: "Roof",
          category: "system",
          purchase_date: "2010-01-01",
          details: { replacement_year_override: 2099, replacement_cost_cents_override: 900000 },
        }),
      ],
      asOfISO: ASOF,
      months: 6,
    });
    expect(forecast.totalCents).toBe(0);
    expect(forecast.months.every((m) => m.events.length === 0)).toBe(true);
  });
});

describe("projectForecast — totals and bigHits", () => {
  it("aggregates monthly totals, averageMonthlyCents, and ranks bigHits largest-first", () => {
    const forecast = projectForecast({
      recurring: [recurring({ amount_cents: 120000, interval_value: 1, interval_unit: "year" })], // $100/mo
      schedules: [
        schedule({
          name: "Filter change",
          next_due_on: "2026-08-15",
          interval_value: 3,
          interval_unit: "month",
          estimated_cost_cents: 9000,
        }),
      ],
      assets: [
        asset({
          name: "Water heater",
          category: "system",
          purchase_date: "2010-09-12",
          details: { replacement_year_override: 2026, replacement_cost_cents_override: 500000 },
        }),
      ],
      asOfISO: ASOF,
      months: 6,
    });

    expect(forecast.totalCents).toBe(578000);
    expect(forecast.averageMonthlyCents).toBe(96333);

    expect(forecast.bigHits.map((h) => ({ kind: h.kind, amountCents: h.amountCents, monthLabel: h.monthLabel }))).toEqual([
      { kind: "replacement", amountCents: 500000, monthLabel: "Sep 2026" },
      { kind: "maintenance", amountCents: 9000, monthLabel: "Aug 2026" },
      { kind: "maintenance", amountCents: 9000, monthLabel: "Nov 2026" },
    ]);
  });

  it("caps bigHits at 8 even when more lumpy events exist", () => {
    const schedules: MaintenanceSchedule[] = Array.from({ length: 10 }, (_, i) =>
      schedule({
        name: `Task ${i}`,
        next_due_on: "2026-07-15",
        interval_value: 100,
        interval_unit: "year",
        estimated_cost_cents: 1000 + i,
      })
    );
    const forecast = projectForecast({
      recurring: [],
      schedules,
      assets: [],
      asOfISO: ASOF,
      months: 6,
    });
    expect(forecast.bigHits).toHaveLength(8);
    // Largest cost (1009) first.
    expect(forecast.bigHits[0].amountCents).toBe(1009);
  });
});
