// Projects the next N months (default 24) of household spending, month by
// month, so the family sees the lumpy reality a flat "$X/month" hides:
//   • recurring commitments — smoothed to their monthly-equivalent each month
//   • scheduled maintenance — each service dropped into the month it comes due
//   • predicted replacements — big one-time hits from the knowledge pack
// Pure functions over already-loaded rows (see docs/decisions.md ADR-011).

import { advanceDate, monthlyCents } from "@/lib/schedule";
import { estimateReplacement } from "@/lib/knowledge/pack";
import type { Asset, MaintenanceSchedule, RecurringExpense } from "@/lib/types";

export type ForecastEvent = {
  kind: "maintenance" | "replacement";
  label: string;
  amountCents: number;
  assetName?: string;
};

export type ForecastMonth = {
  monthISO: string; // first of month, YYYY-MM-01
  label: string; // "Jul 2026"
  recurringCents: number;
  maintenanceCents: number;
  replacementCents: number;
  totalCents: number;
  events: ForecastEvent[];
};

export type Forecast = {
  months: ForecastMonth[];
  totalCents: number;
  averageMonthlyCents: number;
  bigHits: (ForecastEvent & { monthLabel: string })[]; // biggest lumpy costs first
};

type AssetForReplacement = Pick<
  Asset,
  | "name"
  | "category"
  | "manufacturer"
  | "model_number"
  | "details"
  | "purchase_date"
  | "status"
>;

function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

export function projectForecast({
  recurring,
  schedules,
  assets,
  asOfISO,
  months = 24,
}: {
  recurring: RecurringExpense[];
  schedules: MaintenanceSchedule[];
  assets: AssetForReplacement[];
  asOfISO: string;
  months?: number;
}): Forecast {
  const [asOfY, asOfM] = asOfISO.split("-").map(Number);
  const startYear = asOfY;
  const startMonthIndex = asOfM - 1; // 0-based

  // Build empty month buckets.
  const buckets: ForecastMonth[] = [];
  for (let i = 0; i < months; i++) {
    const idx = startMonthIndex + i;
    const year = startYear + Math.floor(idx / 12);
    const monthIndex = ((idx % 12) + 12) % 12;
    buckets.push({
      monthISO: `${year}-${pad(monthIndex + 1)}-01`,
      label: monthLabel(year, monthIndex),
      recurringCents: 0,
      maintenanceCents: 0,
      replacementCents: 0,
      totalCents: 0,
      events: [],
    });
  }

  const horizonStartISO = buckets[0].monthISO;
  const lastBucket = buckets[months - 1];
  const horizonEndISO = lastDayOfMonthISO(lastBucket.monthISO);

  // Map an ISO date to its bucket index, or -1 if outside the window.
  const indexForISO = (iso: string): number => {
    const [y, m] = iso.split("-").map(Number);
    const idx = (y - startYear) * 12 + (m - 1 - startMonthIndex);
    return idx >= 0 && idx < months ? idx : -1;
  };

  // 1. Recurring commitments — the smoothed monthly-equivalent, each month the
  //    commitment is active (respecting starts_on / ends_on).
  for (const b of buckets) {
    const first = b.monthISO;
    const last = lastDayOfMonthISO(b.monthISO);
    for (const re of recurring) {
      if (re.starts_on > last) continue;
      if (re.ends_on !== null && re.ends_on < first) continue;
      b.recurringCents += monthlyCents(re.amount_cents, re.interval_value, re.interval_unit);
    }
  }

  // 2. Scheduled maintenance — walk each active schedule and drop each due
  //    occurrence into its month.
  for (const s of schedules) {
    if (!s.is_active || !s.next_due_on || !s.estimated_cost_cents || s.estimated_cost_cents <= 0)
      continue;
    const cost = s.estimated_cost_cents;

    let occ = s.next_due_on;
    // Overdue: count it once in the first month, then catch up to the window.
    if (occ < horizonStartISO) {
      addMaintenance(buckets[0], cost, s.name);
      let guard = 0;
      while (occ < horizonStartISO && guard++ < 3000) {
        occ = advanceDate(occ, s.interval_value, s.interval_unit);
      }
    }
    let guard = 0;
    while (occ <= horizonEndISO && guard++ < 1000) {
      const idx = indexForISO(occ);
      if (idx >= 0) addMaintenance(buckets[idx], cost, s.name);
      occ = advanceDate(occ, s.interval_value, s.interval_unit);
    }
  }

  // 3. Predicted replacements — one-time hits from the knowledge pack.
  for (const asset of assets) {
    if (asset.status !== "active") continue;
    const est = estimateReplacement(asset);
    if (!est) continue;
    const year =
      est.yearOverride ??
      (est.yearLow !== null && est.yearHigh !== null
        ? Math.round((est.yearLow + est.yearHigh) / 2)
        : null);
    if (year === null) continue;

    // Place it in the asset's purchase month if known, else mid-year.
    const monthNum = asset.purchase_date ? Number(asset.purchase_date.slice(5, 7)) : 6;
    const iso = `${year}-${pad(monthNum)}-01`;
    const idx = indexForISO(iso);
    if (idx < 0) continue;

    const cost =
      est.costOverrideCents ?? Math.round((est.costLowCents + est.costHighCents) / 2);
    const b = buckets[idx];
    b.replacementCents += cost;
    b.events.push({
      kind: "replacement",
      label: `Replace ${asset.name}`,
      amountCents: cost,
      assetName: asset.name,
    });
  }

  // Totals.
  let totalCents = 0;
  for (const b of buckets) {
    b.totalCents = b.recurringCents + b.maintenanceCents + b.replacementCents;
    totalCents += b.totalCents;
  }

  // Biggest lumpy costs (maintenance + replacement events), largest first.
  const bigHits = buckets
    .flatMap((b) => b.events.map((e) => ({ ...e, monthLabel: b.label })))
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 8);

  return {
    months: buckets,
    totalCents,
    averageMonthlyCents: months > 0 ? Math.round(totalCents / months) : 0,
    bigHits,
  };
}

function addMaintenance(bucket: ForecastMonth, cost: number, name: string): void {
  bucket.maintenanceCents += cost;
  bucket.events.push({ kind: "maintenance", label: name, amountCents: cost });
}

function lastDayOfMonthISO(firstOfMonthISO: string): string {
  const [y, m] = firstOfMonthISO.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${pad(m)}-${pad(lastDay)}`;
}
