// Mileage-aware due-date math for vehicle maintenance (see docs/decisions.md
// ADR-014). Pure, dependency-free functions — no Supabase, no DOM — so they
// can be unit-tested directly, same philosophy as src/lib/budget/.

// The FHWA's commonly-cited U.S. average annual mileage, used as a last-resort
// fallback when a vehicle has no mileage history yet. Same citation basis as
// src/lib/knowledge/data/maintenance-schedules.json's _source.
export const NATIONAL_AVERAGE_MILES_PER_YEAR = 13_500;

const MS_PER_YEAR = 365.25 * 86_400_000;

function yearsBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00").getTime();
  const to = new Date(toISO + "T00:00:00").getTime();
  return (to - from) / MS_PER_YEAR;
}

function addYearsToISO(fromISO: string, years: number): string {
  const date = new Date(new Date(fromISO + "T00:00:00").getTime() + years * MS_PER_YEAR);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type MileageReading = { date: string; mileage: number };

export type MilesPerYearMethod = "readings" | "since_purchase" | "national_average";

export type MilesPerYearEstimate = {
  milesPerYear: number;
  method: MilesPerYearMethod;
  pointsUsed: number;
};

// Estimate a vehicle's annual mileage from whatever's known, in order of
// preference: (1) the secant slope between the earliest and latest of all
// known (date, mileage) readings — service logs plus the asset's own current
// reading; (2) if only one reading exists, the slope since purchase_date,
// treating purchase as a zero-mileage start (an approximation — wrong for a
// used car bought with existing mileage, but self-corrects once a second
// reading exists); (3) the national average, when nothing is known at all.
export function estimateMilesPerYear(params: {
  purchaseDate: string | null;
  currentMileage: number | null;
  currentMileageAsOf: string | null;
  logReadings: MileageReading[];
}): MilesPerYearEstimate {
  const points: MileageReading[] = [...params.logReadings];
  if (params.currentMileage != null && params.currentMileageAsOf) {
    points.push({ date: params.currentMileageAsOf, mileage: params.currentMileage });
  }
  const sorted = points
    .filter((p) => Number.isFinite(p.mileage) && p.mileage >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length >= 2) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const years = yearsBetween(first.date, last.date);
    if (years > 0 && last.mileage > first.mileage) {
      return {
        milesPerYear: (last.mileage - first.mileage) / years,
        method: "readings",
        pointsUsed: sorted.length,
      };
    }
  }

  if (sorted.length === 1 && params.purchaseDate) {
    const years = yearsBetween(params.purchaseDate, sorted[0].date);
    if (years > 0.1) {
      return {
        milesPerYear: sorted[0].mileage / years,
        method: "since_purchase",
        pointsUsed: 1,
      };
    }
  }

  return {
    milesPerYear: NATIONAL_AVERAGE_MILES_PER_YEAR,
    method: "national_average",
    pointsUsed: sorted.length,
  };
}

export type DueReason = "time" | "mileage" | "both";

export type EffectiveDue = {
  dueOn: string | null;
  reason: DueReason | null;
  timeDueOn: string | null;
  mileageDueOn: string | null;
  mileageDueAt: number | null;
};

// Projects when a mileage-based interval will next be reached (given the
// vehicle's current mileage and estimated annual rate), then returns whichever
// of that projection or the calendar due date comes first — clearly labeled
// which rule triggered it. Falls back to the current mileage as the interval's
// baseline when the schedule has never been serviced with a mileage reading
// attached.
export function effectiveDueDate(params: {
  timeDueOn: string | null;
  intervalMiles: number | null;
  lastServiceMileage: number | null;
  currentMileage: number | null;
  currentMileageAsOf: string | null;
  milesPerYear: number;
}): EffectiveDue {
  const {
    timeDueOn,
    intervalMiles,
    lastServiceMileage,
    currentMileage,
    currentMileageAsOf,
    milesPerYear,
  } = params;

  let mileageDueOn: string | null = null;
  let mileageDueAt: number | null = null;

  if (intervalMiles != null && currentMileage != null && currentMileageAsOf && milesPerYear > 0) {
    const base = lastServiceMileage ?? currentMileage;
    mileageDueAt = base + intervalMiles;
    const milesRemaining = mileageDueAt - currentMileage;
    mileageDueOn = addYearsToISO(currentMileageAsOf, milesRemaining / milesPerYear);
  }

  if (timeDueOn && mileageDueOn) {
    if (timeDueOn === mileageDueOn) {
      return { dueOn: timeDueOn, reason: "both", timeDueOn, mileageDueOn, mileageDueAt };
    }
    const timeIsEarlier = timeDueOn < mileageDueOn;
    return {
      dueOn: timeIsEarlier ? timeDueOn : mileageDueOn,
      reason: timeIsEarlier ? "time" : "mileage",
      timeDueOn,
      mileageDueOn,
      mileageDueAt,
    };
  }
  if (mileageDueOn) {
    return { dueOn: mileageDueOn, reason: "mileage", timeDueOn: null, mileageDueOn, mileageDueAt };
  }
  if (timeDueOn) {
    return { dueOn: timeDueOn, reason: "time", timeDueOn, mileageDueOn: null, mileageDueAt: null };
  }
  return { dueOn: null, reason: null, timeDueOn: null, mileageDueOn: null, mileageDueAt: null };
}
