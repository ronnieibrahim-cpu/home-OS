// Shared date, interval, and money-normalization helpers for maintenance
// schedules and recurring expenses. Kept dependency-free so both server
// actions and client (optimistic) components can import them.

import type {
  MaintenanceIntervalUnit,
  RecurringIntervalUnit,
} from "@/lib/types";

type IntervalUnit = MaintenanceIntervalUnit | RecurringIntervalUnit;

// Local calendar date as YYYY-MM-DD (what the DB `date` columns expect).
export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Advance a YYYY-MM-DD date by N units. Month/year math clamps to the end of
// the target month (Jan 31 + 1 month -> Feb 28/29) rather than rolling over.
export function advanceDate(
  fromISO: string,
  value: number,
  unit: IntervalUnit
): string {
  const [y, m, d] = fromISO.split("-").map(Number);
  if (unit === "day" || unit === "week") {
    const base = new Date(y, m - 1, d);
    base.setDate(base.getDate() + value * (unit === "week" ? 7 : 1));
    return toISO(base);
  }
  const monthsToAdd = unit === "year" ? value * 12 : value;
  const targetMonthIndex = m - 1 + monthsToAdd;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return toISO(new Date(targetYear, targetMonth, Math.min(d, lastDay)));
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "every 3 months" / "monthly" / "weekly" / "yearly".
export function describeInterval(value: number, unit: IntervalUnit): string {
  if (value === 1) {
    return { day: "daily", week: "weekly", month: "monthly", year: "yearly" }[
      unit
    ];
  }
  return `every ${value} ${unit}s`;
}

// Normalize a recurring amount to a monthly figure. Must match the SQL in
// v_monthly_recurring_costs exactly (docs/ontology.md) so the client-side
// optimistic total agrees with the server view.
export function monthlyCents(
  amountCents: number,
  value: number,
  unit: RecurringIntervalUnit
): number {
  const monthly =
    unit === "week"
      ? (amountCents * 52) / 12 / value
      : unit === "year"
        ? amountCents / 12 / value
        : amountCents / value;
  return Math.round(monthly);
}

export type DueTone = "overdue" | "soon" | "ok";

// Whole-day difference between a due date and today, plus a human label and a
// tone the UI can color by. "soon" = due within a week.
export function dueInfo(nextDueISO: string | null): {
  label: string;
  tone: DueTone;
  days: number | null;
} {
  if (!nextDueISO) return { label: "No date set", tone: "ok", days: null };
  const today = new Date(todayISO() + "T00:00:00");
  const due = new Date(nextDueISO + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) {
    const n = Math.abs(days);
    return { label: `${n} day${n === 1 ? "" : "s"} overdue`, tone: "overdue", days };
  }
  if (days === 0) return { label: "Due today", tone: "soon", days };
  if (days === 1) return { label: "Due tomorrow", tone: "soon", days };
  if (days <= 7) return { label: `Due in ${days} days`, tone: "soon", days };
  if (days <= 30) return { label: `Due in ${days} days`, tone: "ok", days };
  const months = Math.round(days / 30);
  return { label: `Due in ~${months} month${months === 1 ? "" : "s"}`, tone: "ok", days };
}
