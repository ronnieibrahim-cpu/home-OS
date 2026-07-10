// Offline asset-form autocomplete, built entirely on the existing knowledge
// pack — no schema change, no network call. Two jobs:
//   1. suggestFromName: guess an asset's category + manufacturer from its
//      free-text name alone (e.g. "Tesla Model Y" -> vehicle / Tesla,
//      "GE dishwasher" -> appliance / GE), before the household has picked a
//      category.
//   2. listManufacturerOptions: the manufacturer type-ahead list for a
//      chosen category.
// Subtype and powertrain need no separate prefill step: matchSubtype() and
// vehicleProfile() (pack.ts) already re-derive those live from name + category
// + manufacturer every time the asset is viewed, so setting category and
// manufacturer correctly is enough for the rest of the pack to kick in.

import { listApplianceManufacturers, listSubtypes, listVehicleMakes } from "./pack";
import type { Subtype } from "./pack";
import type { AssetCategory } from "@/lib/types";

// Whole-word/phrase match, bounded by non-alphanumeric characters (or string
// edges) on both sides — so a short keyword like "ge" matches the standalone
// word "GE" but not the "ge" inside "range" or "garage".
function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

export type NameSuggestion = {
  category: AssetCategory;
  subtypeLabel: string;
  manufacturer: string | null;
};

// Scans a free-text asset name against every subtype (any category) plus
// both manufacturer lists. When several subtypes match, the longest keyword
// wins (e.g. "model y" beats a coincidental shorter match), which keeps this
// resistant to the same false-positive risk callers must watch for elsewhere
// in the pack (best-effort, not exhaustive — see docs/decisions.md ADR-010).
export function suggestFromName(name: string): NameSuggestion | null {
  const text = name.toLowerCase().trim();
  if (!text) return null;

  const subtypeMatches: { subtype: Subtype; keyword: string }[] = [];
  for (const subtype of listSubtypes()) {
    const keyword = subtype.keywords.find((kw) => containsWord(text, kw));
    if (keyword) subtypeMatches.push({ subtype, keyword });
  }
  if (subtypeMatches.length === 0) return null;
  subtypeMatches.sort((a, b) => b.keyword.length - a.keyword.length);
  const best = subtypeMatches[0].subtype;

  const manufacturer =
    best.assetCategory === "vehicle"
      ? listVehicleMakes().find((m) => m.keywords.some((kw) => containsWord(text, kw)))?.label ?? null
      : listApplianceManufacturers().find((m) => m.keywords.some((kw) => containsWord(text, kw)))?.label ??
        null;

  return { category: best.assetCategory, subtypeLabel: best.label, manufacturer };
}

// The manufacturer type-ahead options for a given category — empty when the
// pack has no manufacturer data for that category (furniture/electronics/
// other, same known limitation as the rest of the pack).
export function listManufacturerOptions(category: AssetCategory): string[] {
  if (category === "vehicle") return listVehicleMakes().map((m) => m.label);
  if (category === "appliance" || category === "system") {
    return listApplianceManufacturers().map((m) => m.label);
  }
  return [];
}
