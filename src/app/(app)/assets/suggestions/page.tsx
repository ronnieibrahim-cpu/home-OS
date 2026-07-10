import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SuggestionsReview, type AssetSuggestionGroup } from "@/components/suggestions-review";
import { getMissingSuggestions } from "@/lib/knowledge/pack";
import type { Asset, MaintenanceSchedule } from "@/lib/types";

// Scans every active asset against the knowledge pack and proposes any
// maintenance schedules it's missing, so the household can review and accept
// them in bulk instead of asset-by-asset.
export default async function MaintenanceSuggestionsPage() {
  const supabase = await createClient();

  const { data: assets } = await supabase
    .from("assets")
    .select("id, name, category, manufacturer, model_number, details")
    .eq("status", "active")
    .order("name");

  const assetList = (assets ?? []) as Pick<
    Asset,
    "id" | "name" | "category" | "manufacturer" | "model_number" | "details"
  >[];
  const assetIds = assetList.map((a) => a.id);

  const { data: schedules } =
    assetIds.length > 0
      ? await supabase
          .from("maintenance_schedules")
          .select("asset_id, name")
          .in("asset_id", assetIds)
      : { data: [] as Pick<MaintenanceSchedule, "asset_id" | "name">[] };

  const namesByAsset = new Map<string, string[]>();
  for (const s of schedules ?? []) {
    const list = namesByAsset.get(s.asset_id) ?? [];
    list.push(s.name);
    namesByAsset.set(s.asset_id, list);
  }

  const groups: AssetSuggestionGroup[] = assetList
    .map((asset) => ({
      assetId: asset.id,
      assetName: asset.name,
      suggestions: getMissingSuggestions(asset, namesByAsset.get(asset.id) ?? []),
      dismissedKeys:
        ((asset.details as { dismissed_suggestions?: string[] } | null)?.dismissed_suggestions) ??
        [],
    }))
    .filter((g) => g.suggestions.length > 0);

  return (
    <div>
      <PageHeader title="Suggested maintenance" backHref="/assets" />
      <p className="mb-4 text-sm text-muted-foreground">
        Based on the knowledge pack&rsquo;s typical schedules for HVAC, water heaters, roofs,
        gutters, vehicles, and major appliances — cross-checked against what each asset
        already has scheduled.
      </p>
      {groups.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Nothing to suggest — every asset we recognize already has its typical
          maintenance scheduled.
        </p>
      ) : (
        <SuggestionsReview groups={groups} />
      )}
    </div>
  );
}
