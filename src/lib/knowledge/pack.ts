// Static "knowledge pack": typical maintenance schedules, lifespans, replacement
// costs, and depreciation curves for common household asset kinds. Pure local
// data + heuristics — no external API calls, no network at request time. Raw
// tables live in ./data/*.json (each has a `_source` field citing its basis);
// this module adds types and the matching/estimation logic on top.
//
// No schema change: matching is done by keyword-scanning the asset's existing
// `name` + `category` fields. A user's confirmed/overridden subtype and any
// replacement-estimate edits are stored in the existing free-form
// `assets.details` JSONB column (see docs/ontology.md — "type-specific facts
// go in `details`"; this pack adds the `subtype`, `dismissed_suggestions`,
// `replacement_year_override`, and `replacement_cost_cents_override` keys as
// a documented convention, not a schema change). See docs/decisions.md ADR-010.

import subtypesData from "./data/subtypes.json";
import maintenanceData from "./data/maintenance-schedules.json";
import lifespansData from "./data/lifespans.json";
import depreciationData from "./data/depreciation-curves.json";
import type { Asset, AssetCategory, MaintenanceIntervalUnit } from "@/lib/types";

export type SubtypeId = (typeof subtypesData.subtypes)[number]["id"];

export type Subtype = {
  id: SubtypeId;
  label: string;
  assetCategory: AssetCategory;
  keywords: string[];
};

const SUBTYPES = subtypesData.subtypes as Subtype[];

export type AssetKnowledgeDetails = {
  subtype?: SubtypeId | "none";
  dismissed_suggestions?: string[];
  replacement_year_override?: number;
  replacement_cost_cents_override?: number;
};

function knowledgeDetails(asset: Pick<Asset, "details">): AssetKnowledgeDetails {
  return (asset.details ?? {}) as AssetKnowledgeDetails;
}

// --- Subtype matching -------------------------------------------------------

// Best-effort guess from the asset's name, scoped to subtypes that share its
// category. A user's explicit choice (details.subtype) always wins; "none"
// opts an asset out of the pack entirely. Only system/appliance/vehicle
// categories are covered — furniture/electronics/other have no pack data.
export function matchSubtype(asset: Pick<Asset, "name" | "category" | "details">): Subtype | null {
  const details = knowledgeDetails(asset);
  if (details.subtype === "none") return null;
  if (details.subtype) {
    const chosen = SUBTYPES.find((s) => s.id === details.subtype);
    if (chosen) return chosen;
  }

  if (!["system", "appliance", "vehicle"].includes(asset.category)) return null;

  const name = asset.name.toLowerCase();
  const candidates = SUBTYPES.filter((s) => s.assetCategory === asset.category);
  const byKeyword = candidates.find((s) => s.keywords.some((kw) => name.includes(kw)));
  if (byKeyword) return byKeyword;

  // Vehicles default to the most common body style when nothing more
  // specific (truck/suv/minivan) is named.
  if (asset.category === "vehicle") {
    return SUBTYPES.find((s) => s.id === "vehicle_sedan") ?? null;
  }
  return null;
}

export function listSubtypes(): Subtype[] {
  return SUBTYPES;
}

// --- Maintenance suggestions -------------------------------------------------

type RawScheduleEntry = {
  task: string;
  intervalValue: number;
  intervalUnit: MaintenanceIntervalUnit;
  costLowCents: number;
  costHighCents: number;
  description?: string;
};

const MAINTENANCE_BY_SUBTYPE = maintenanceData.bySubtype as Record<string, RawScheduleEntry[]>;

// All vehicle body styles share one calendar-based preventive schedule (see
// data/maintenance-schedules.json `_source`); lifespan/cost/depreciation vary
// by body style and are looked up by the specific subtype elsewhere.
function maintenanceKeyFor(subtypeId: SubtypeId): string {
  return subtypeId.startsWith("vehicle_") ? "vehicle" : subtypeId;
}

export type SuggestedSchedule = {
  key: string;
  name: string;
  description: string | null;
  intervalValue: number;
  intervalUnit: MaintenanceIntervalUnit;
  estimatedCostLowCents: number;
  estimatedCostHighCents: number;
  estimatedCostMidCents: number;
};

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeName(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getPackSchedules(subtypeId: SubtypeId): SuggestedSchedule[] {
  const entries = MAINTENANCE_BY_SUBTYPE[maintenanceKeyFor(subtypeId)] ?? [];
  return entries.map((e) => ({
    key: `${subtypeId}:${slugify(e.task)}`,
    name: e.task,
    description: e.description ?? null,
    intervalValue: e.intervalValue,
    intervalUnit: e.intervalUnit,
    estimatedCostLowCents: e.costLowCents,
    estimatedCostHighCents: e.costHighCents,
    estimatedCostMidCents: Math.round((e.costLowCents + e.costHighCents) / 2),
  }));
}

// A suggestion is "already covered" if an existing schedule's name is
// basically the same task — a simple substring match on normalized text, not
// an exact key match, since existing schedules were typed by hand.
function isAlreadyScheduled(existingNames: string[], suggestionName: string): boolean {
  const target = normalizeName(suggestionName);
  return existingNames.some((n) => {
    const existing = normalizeName(n);
    return existing === target || existing.includes(target) || target.includes(existing);
  });
}

// The suggestions for one asset: pack schedules for its matched subtype minus
// whatever it already has scheduled and whatever the user dismissed.
export function getMissingSuggestions(
  asset: Pick<Asset, "name" | "category" | "details">,
  existingScheduleNames: string[]
): SuggestedSchedule[] {
  const subtype = matchSubtype(asset);
  if (!subtype) return [];
  const dismissed = new Set(knowledgeDetails(asset).dismissed_suggestions ?? []);
  return getPackSchedules(subtype.id).filter(
    (s) => !dismissed.has(s.key) && !isAlreadyScheduled(existingScheduleNames, s.name)
  );
}

// --- Replacement estimate ----------------------------------------------------

type LifespanEntry = {
  lifespanYearsLow: number;
  lifespanYearsHigh: number;
  replacementCostLowCents: number;
  replacementCostHighCents: number;
};

const LIFESPANS_BY_SUBTYPE = lifespansData.bySubtype as Record<string, LifespanEntry>;

export type ReplacementEstimate = {
  subtype: Subtype;
  lifespanYearsLow: number;
  lifespanYearsHigh: number;
  costLowCents: number;
  costHighCents: number;
  // Year range is only computable when the asset has a purchase date.
  yearLow: number | null;
  yearHigh: number | null;
  // Present when the household has edited the default estimate.
  yearOverride: number | null;
  costOverrideCents: number | null;
};

export function estimateReplacement(
  asset: Pick<Asset, "name" | "category" | "details" | "purchase_date">
): ReplacementEstimate | null {
  const subtype = matchSubtype(asset);
  if (!subtype) return null;
  const lifespan = LIFESPANS_BY_SUBTYPE[subtype.id];
  if (!lifespan) return null;

  const details = knowledgeDetails(asset);
  let yearLow: number | null = null;
  let yearHigh: number | null = null;
  if (asset.purchase_date) {
    const purchaseYear = Number(asset.purchase_date.slice(0, 4));
    if (Number.isFinite(purchaseYear)) {
      yearLow = purchaseYear + lifespan.lifespanYearsLow;
      yearHigh = purchaseYear + lifespan.lifespanYearsHigh;
    }
  }

  return {
    subtype,
    lifespanYearsLow: lifespan.lifespanYearsLow,
    lifespanYearsHigh: lifespan.lifespanYearsHigh,
    costLowCents: lifespan.replacementCostLowCents,
    costHighCents: lifespan.replacementCostHighCents,
    yearLow,
    yearHigh,
    yearOverride: details.replacement_year_override ?? null,
    costOverrideCents: details.replacement_cost_cents_override ?? null,
  };
}

// --- Current estimated value (depreciation) ---------------------------------

const VEHICLE_CURVE = depreciationData.vehicle.retainedFractionByAge;
const APPLIANCE_SALVAGE_FRACTION = depreciationData.appliance.salvageFraction;

export type CurrentValueEstimate = {
  valueCents: number;
  ageYears: number;
};

// Only vehicles and appliances have a depreciation curve in the pack (systems
// like HVAC/roof are tracked by service life, not resale value).
export function estimateCurrentValue(
  asset: Pick<Asset, "name" | "category" | "details" | "purchase_date" | "purchase_price_cents">
): CurrentValueEstimate | null {
  if (asset.purchase_price_cents == null || !asset.purchase_date) return null;
  if (asset.category !== "vehicle" && asset.category !== "appliance") return null;

  const purchaseDate = new Date(asset.purchase_date + "T00:00:00");
  const ageYears = (Date.now() - purchaseDate.getTime()) / (365.25 * 86_400_000);
  if (ageYears < 0) return null;

  let fraction: number;
  if (asset.category === "vehicle") {
    const index = Math.min(Math.floor(ageYears), VEHICLE_CURVE.length - 1);
    fraction = VEHICLE_CURVE[index];
  } else {
    const subtype = matchSubtype(asset);
    const lifespanYears = subtype
      ? ((LIFESPANS_BY_SUBTYPE[subtype.id]?.lifespanYearsLow ?? 12) +
          (LIFESPANS_BY_SUBTYPE[subtype.id]?.lifespanYearsHigh ?? 12)) /
        2
      : 12;
    fraction = Math.max(APPLIANCE_SALVAGE_FRACTION, 1 - ageYears / lifespanYears);
  }

  return {
    valueCents: Math.round(asset.purchase_price_cents * fraction),
    ageYears,
  };
}
