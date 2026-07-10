// Blends the household's three money sources into one monthly budget, grouped
// by category, without double-counting (see docs/decisions.md ADR-011):
//
//   per category  =  committed recurring (normalized to monthly)
//                  +  amortized maintenance reserve  (maintenance only)
//                  +  averaged "extras": actual expenses that are NOT tied to a
//                     recurring commitment and are NOT maintenance/repair
//
// Pure functions over already-loaded rows — no database access here.

import { monthlyCents } from "@/lib/schedule";
import type {
  Expense,
  MaintenanceSchedule,
  MaintenanceIntervalUnit,
  RecurringExpense,
} from "@/lib/types";

export type BudgetLine = {
  category: string;
  committedCents: number;
  reserveCents: number;
  extrasCents: number;
  totalCents: number;
};

export type CurrentBudget = {
  lines: BudgetLine[]; // sorted high → low by total
  totalCents: number;
  committedTotalCents: number;
  reserveTotalCents: number;
  extrasTotalCents: number;
  actualsMonths: number; // trailing window used to average extras
  housingCommittedCents: number; // committed "mortgage" category — the scenario's replace default
};

const MAINTENANCE_CATEGORY = "maintenance";

// Average days per month, for converting day/week maintenance intervals.
const AVG_DAYS_PER_MONTH = 30.4375;
const UNIT_MONTHS: Record<MaintenanceIntervalUnit, number> = {
  day: 1 / AVG_DAYS_PER_MONTH,
  week: 7 / AVG_DAYS_PER_MONTH,
  month: 1,
  year: 12,
};

// Amortize a one-off maintenance cost across its interval → a monthly reserve.
export function amortizeToMonthlyCents(
  costCents: number,
  intervalValue: number,
  intervalUnit: MaintenanceIntervalUnit
): number {
  const months = intervalValue * UNIT_MONTHS[intervalUnit];
  return months > 0 ? Math.round(costCents / months) : 0;
}

function isRecurringActive(re: RecurringExpense, asOfISO: string): boolean {
  return re.starts_on <= asOfISO && (re.ends_on === null || re.ends_on >= asOfISO);
}

// asOfISO defaults to today; actualsMonths is the trailing window for extras.
export function buildCurrentBudget({
  recurring,
  schedules,
  expenses,
  asOfISO,
  actualsMonths = 12,
}: {
  recurring: RecurringExpense[];
  schedules: MaintenanceSchedule[];
  expenses: Expense[];
  asOfISO: string;
  actualsMonths?: number;
}): CurrentBudget {
  const committed = new Map<string, number>();
  const reserve = new Map<string, number>();
  const extras = new Map<string, number>();

  // 1. Committed recurring commitments, normalized to monthly (matches the
  //    v_monthly_recurring_costs view formula via monthlyCents).
  for (const re of recurring) {
    if (!isRecurringActive(re, asOfISO)) continue;
    const m = monthlyCents(re.amount_cents, re.interval_value, re.interval_unit);
    committed.set(re.category, (committed.get(re.category) ?? 0) + m);
  }

  // 2. Amortized maintenance reserve (all under the "maintenance" category).
  for (const s of schedules) {
    if (!s.is_active || s.estimated_cost_cents == null || s.estimated_cost_cents <= 0) continue;
    const m = amortizeToMonthlyCents(s.estimated_cost_cents, s.interval_value, s.interval_unit);
    reserve.set(MAINTENANCE_CATEGORY, (reserve.get(MAINTENANCE_CATEGORY) ?? 0) + m);
  }

  // 3. Extras: trailing-window average of actual expenses that aren't tied to a
  //    commitment and aren't maintenance/repair (the reserve covers those).
  const windowStart = subtractMonthsISO(asOfISO, actualsMonths);
  const extrasTotalByCat = new Map<string, number>();
  for (const e of expenses) {
    if (e.recurring_expense_id !== null) continue;
    if (e.category === "maintenance" || e.category === "repair") continue;
    if (e.incurred_on < windowStart || e.incurred_on > asOfISO) continue;
    extrasTotalByCat.set(e.category, (extrasTotalByCat.get(e.category) ?? 0) + e.amount_cents);
  }
  for (const [cat, total] of extrasTotalByCat) {
    extras.set(cat, Math.round(total / actualsMonths));
  }

  // Merge into one line per category.
  const categories = new Set<string>([...committed.keys(), ...reserve.keys(), ...extras.keys()]);
  const lines: BudgetLine[] = [];
  for (const category of categories) {
    const committedCents = committed.get(category) ?? 0;
    const reserveCents = reserve.get(category) ?? 0;
    const extrasCents = extras.get(category) ?? 0;
    lines.push({
      category,
      committedCents,
      reserveCents,
      extrasCents,
      totalCents: committedCents + reserveCents + extrasCents,
    });
  }
  lines.sort((a, b) => b.totalCents - a.totalCents);

  const committedTotalCents = sum(committed.values());
  const reserveTotalCents = sum(reserve.values());
  const extrasTotalCents = sum(extras.values());

  return {
    lines,
    totalCents: committedTotalCents + reserveTotalCents + extrasTotalCents,
    committedTotalCents,
    reserveTotalCents,
    extrasTotalCents,
    actualsMonths,
    housingCommittedCents: committed.get("mortgage") ?? 0,
  };
}

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

// Step a YYYY-MM-DD date back N months (clamping the day to the target month).
function subtractMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const targetIndex = m - 1 - months;
  const year = y + Math.floor(targetIndex / 12);
  const month = ((targetIndex % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = String(Math.min(d, lastDay)).padStart(2, "0");
  return `${year}-${String(month + 1).padStart(2, "0")}-${day}`;
}
