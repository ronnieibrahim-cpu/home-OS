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
import vehicleMakesData from "./data/vehicle-makes.json";
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
  // Vehicles only: household's confirmed powertrain, overriding the make/model
  // guess. Drives which maintenance schedule and depreciation curve apply
  // (an electric car gets no oil change). See ADR-012.
  powertrain?: Powertrain;
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

// --- Vehicle make / powertrain ----------------------------------------------

// A vehicle's powertrain determines its maintenance (an EV has no oil change)
// and its depreciation curve. `phev` (plug-in hybrid) still has a gas engine,
// so it shares the hybrid maintenance schedule.
export type Powertrain = "gas" | "hybrid" | "phev" | "electric";

export const POWERTRAINS: { id: Powertrain; label: string }[] = [
  { id: "gas", label: "Gas" },
  { id: "hybrid", label: "Hybrid" },
  { id: "phev", label: "Plug-in hybrid" },
  { id: "electric", label: "Electric" },
];

export type SegmentTier = "economy" | "mainstream" | "premium" | "luxury";

type VehicleMake = {
  id: string;
  label: string;
  keywords: string[];
  segmentTier: SegmentTier;
  defaultPowertrain: Powertrain;
  evKeywords: string[];
  phevKeywords: string[];
  hybridKeywords: string[];
};

const MAKES = vehicleMakesData.makes as VehicleMake[];
const GENERIC_POWERTRAIN = vehicleMakesData.genericPowertrainKeywords as Record<
  "phev" | "electric" | "hybrid",
  string[]
>;
const TIER_MULTIPLIERS = depreciationData.vehicleSegmentTierMultipliers as Record<string, number>;

// Everything a make/model tells us about a vehicle: its powertrain (guessed or
// household-confirmed), its brand and market tier, and the tier's cost multiplier.
export type VehicleProfile = {
  powertrain: Powertrain;
  powertrainOverridden: boolean;
  make: { id: string; label: string } | null;
  segmentTier: SegmentTier;
  tierMultiplier: number;
};

type VehicleFields = Pick<Asset, "name" | "category" | "details"> &
  Partial<Pick<Asset, "manufacturer" | "model_number">>;

function vehicleText(asset: VehicleFields): string {
  return [asset.manufacturer, asset.model_number, asset.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function detectPowertrain(text: string, make: VehicleMake | null): Powertrain {
  if (make) {
    // Pure-EV brands (Tesla, Rivian…) are electric regardless of model text.
    if (make.defaultPowertrain === "electric") return "electric";
    if (make.phevKeywords.some((kw) => text.includes(kw))) return "phev";
    if (make.evKeywords.some((kw) => text.includes(kw))) return "electric";
    if (make.hybridKeywords.some((kw) => text.includes(kw))) return "hybrid";
  }
  // Make-independent fallbacks (checked PHEV → electric → hybrid so "plug-in
  // hybrid" doesn't get mistaken for a pure EV).
  if (GENERIC_POWERTRAIN.phev.some((kw) => text.includes(kw))) return "phev";
  if (GENERIC_POWERTRAIN.electric.some((kw) => text.includes(kw))) return "electric";
  if (GENERIC_POWERTRAIN.hybrid.some((kw) => text.includes(kw))) return "hybrid";
  return make?.defaultPowertrain ?? "gas";
}

// Best-effort make/powertrain profile for a vehicle asset; null for non-vehicles.
// A household override in details.powertrain always wins over the guess.
export function vehicleProfile(asset: VehicleFields): VehicleProfile | null {
  if (asset.category !== "vehicle") return null;

  const text = vehicleText(asset);
  const make = MAKES.find((m) => m.keywords.some((kw) => text.includes(kw))) ?? null;
  const segmentTier: SegmentTier = make?.segmentTier ?? "mainstream";
  const tierMultiplier = TIER_MULTIPLIERS[segmentTier] ?? 1;

  const override = knowledgeDetails(asset).powertrain;
  const validOverride = POWERTRAINS.some((p) => p.id === override)
    ? (override as Powertrain)
    : null;

  return {
    powertrain: validOverride ?? detectPowertrain(text, make),
    powertrainOverridden: validOverride != null,
    make: make ? { id: make.id, label: make.label } : null,
    segmentTier,
    tierMultiplier,
  };
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

// Vehicle maintenance is keyed by powertrain, not body style: gas, hybrid, and
// electric cars need different upkeep (an EV has no oil change). Plug-in hybrids
// share the hybrid schedule (they still have a gas engine). Lifespan/cost by
// body style and tier are looked up elsewhere.
function maintenanceKeyFor(subtypeId: SubtypeId, powertrain: Powertrain | null): string {
  if (!subtypeId.startsWith("vehicle_")) return subtypeId;
  const group =
    powertrain === "electric"
      ? "electric"
      : powertrain === "hybrid" || powertrain === "phev"
        ? "hybrid"
        : "gas";
  return `vehicle_${group}`;
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

export function getPackSchedules(
  subtypeId: SubtypeId,
  powertrain: Powertrain | null = null
): SuggestedSchedule[] {
  const entries = MAINTENANCE_BY_SUBTYPE[maintenanceKeyFor(subtypeId, powertrain)] ?? [];
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
  asset: VehicleFields,
  existingScheduleNames: string[]
): SuggestedSchedule[] {
  const subtype = matchSubtype(asset);
  if (!subtype) return [];
  const powertrain = vehicleProfile(asset)?.powertrain ?? null;
  const dismissed = new Set(knowledgeDetails(asset).dismissed_suggestions ?? []);
  return getPackSchedules(subtype.id, powertrain).filter(
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
  asset: VehicleFields & Pick<Asset, "purchase_date">
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

  // Vehicles: scale the body-style cost band by the brand's market tier, so a
  // luxury EV's estimated replacement cost sits above an economy sedan's.
  const tierMultiplier =
    asset.category === "vehicle" ? (vehicleProfile(asset)?.tierMultiplier ?? 1) : 1;

  return {
    subtype,
    lifespanYearsLow: lifespan.lifespanYearsLow,
    lifespanYearsHigh: lifespan.lifespanYearsHigh,
    costLowCents: Math.round(lifespan.replacementCostLowCents * tierMultiplier),
    costHighCents: Math.round(lifespan.replacementCostHighCents * tierMultiplier),
    yearLow,
    yearHigh,
    yearOverride: details.replacement_year_override ?? null,
    costOverrideCents: details.replacement_cost_cents_override ?? null,
  };
}

// --- Current estimated value (depreciation) ---------------------------------

const VEHICLE_CURVE = depreciationData.vehicle.retainedFractionByAge;
const VEHICLE_EV_CURVE = depreciationData.vehicle_electric.retainedFractionByAge;
const APPLIANCE_SALVAGE_FRACTION = depreciationData.appliance.salvageFraction;

export type CurrentValueEstimate = {
  valueCents: number;
  ageYears: number;
};

// Only vehicles and appliances have a depreciation curve in the pack (systems
// like HVAC/roof are tracked by service life, not resale value).
export function estimateCurrentValue(
  asset: VehicleFields & Pick<Asset, "purchase_date" | "purchase_price_cents">
): CurrentValueEstimate | null {
  if (asset.purchase_price_cents == null || !asset.purchase_date) return null;
  if (asset.category !== "vehicle" && asset.category !== "appliance") return null;

  const purchaseDate = new Date(asset.purchase_date + "T00:00:00");
  const ageYears = (Date.now() - purchaseDate.getTime()) / (365.25 * 86_400_000);
  if (ageYears < 0) return null;

  let fraction: number;
  if (asset.category === "vehicle") {
    // EVs depreciate faster early, so electric vehicles use their own curve.
    const curve = vehicleProfile(asset)?.powertrain === "electric" ? VEHICLE_EV_CURVE : VEHICLE_CURVE;
    const index = Math.min(Math.floor(ageYears), curve.length - 1);
    fraction = curve[index];
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
