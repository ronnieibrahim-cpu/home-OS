"use client";

import Link from "next/link";
import { useMemo, useOptimistic, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/format";
import { describeInterval } from "@/lib/schedule";
import {
  acceptMaintenanceSuggestion,
  acceptMaintenanceSuggestionsBulk,
} from "@/lib/actions/maintenance";
import { dismissMaintenanceSuggestion } from "@/lib/actions/assets";
import type { SuggestedSchedule } from "@/lib/knowledge/pack";

export type AssetSuggestionGroup = {
  assetId: string;
  assetName: string;
  suggestions: SuggestedSchedule[];
  dismissedKeys: string[];
};

type Item = {
  itemKey: string;
  assetId: string;
  assetName: string;
  dismissedKeys: string[];
  suggestion: SuggestedSchedule;
};

function flatten(groups: AssetSuggestionGroup[]): Item[] {
  return groups.flatMap((g) =>
    g.suggestions.map((s) => ({
      itemKey: `${g.assetId}:${s.key}`,
      assetId: g.assetId,
      assetName: g.assetName,
      dismissedKeys: g.dismissedKeys,
      suggestion: s,
    }))
  );
}

// Bulk review: every missing suggestion across every asset, groupable by
// asset, with per-item accept/dismiss and a "select all, add in one tap" bulk
// action. Mirrors the per-asset panel's accept/dismiss actions so state (what
// was dismissed) stays consistent between the two screens.
export function SuggestionsReview({ groups }: { groups: AssetSuggestionGroup[] }) {
  const [error, setError] = useState<string | null>(null);
  const [items, applyOptimistic] = useOptimistic(
    flatten(groups),
    (state: Item[], removedKeys: string[]) =>
      state.filter((i) => !removedKeys.includes(i.itemKey))
  );
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const byAsset = useMemo(() => {
    const map = new Map<string, { assetName: string; items: Item[] }>();
    for (const item of items) {
      const entry = map.get(item.assetId) ?? { assetName: item.assetName, items: [] };
      entry.items.push(item);
      map.set(item.assetId, entry);
    }
    return [...map.entries()];
  }, [items]);

  const selectedCount = items.filter((i) => !unchecked.has(i.itemKey)).length;

  function toggle(itemKey: string) {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  }

  async function handleAcceptOne(item: Item) {
    applyOptimistic([item.itemKey]);
    const res = await acceptMaintenanceSuggestion(item.assetId, item.suggestion);
    if (res?.error) setError(res.error);
  }

  async function handleDismissOne(item: Item) {
    applyOptimistic([item.itemKey]);
    const res = await dismissMaintenanceSuggestion(
      item.assetId,
      item.suggestion.key,
      item.dismissedKeys
    );
    if (res?.error) setError(res.error);
  }

  async function handleAddSelected() {
    const selected = items.filter((i) => !unchecked.has(i.itemKey));
    if (selected.length === 0) return;
    setSubmitting(true);
    applyOptimistic(selected.map((i) => i.itemKey));
    const res = await acceptMaintenanceSuggestionsBulk(
      selected.map((i) => ({ assetId: i.assetId, suggestion: i.suggestion }))
    );
    setSubmitting(false);
    if (res?.error) setError(res.error);
  }

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        All caught up — nothing left to review.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}

      {byAsset.map(([assetId, { assetName, items: assetItems }]) => (
        <div key={assetId} className="rounded-md border p-4">
          <Link
            href={`/assets/${assetId}`}
            className="mb-2 block truncate text-sm font-semibold underline-offset-2 hover:underline"
          >
            {assetName}
          </Link>
          <div className="flex flex-col gap-2">
            {assetItems.map((item) => (
              <label
                key={item.itemKey}
                className="flex items-center gap-3 rounded-md border px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={!unchecked.has(item.itemKey)}
                  onChange={() => toggle(item.itemKey)}
                  className="size-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.suggestion.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {describeInterval(item.suggestion.intervalValue, item.suggestion.intervalUnit)}
                    {item.suggestion.estimatedCostHighCents > 0
                      ? ` · ~${formatCents(item.suggestion.estimatedCostLowCents)}–${formatCents(item.suggestion.estimatedCostHighCents)}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-3"
                  onClick={() => handleAcceptOne(item)}
                >
                  <Check className="size-4" /> Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-muted-foreground"
                  onClick={() => handleDismissOne(item)}
                  aria-label="Dismiss suggestion"
                >
                  <X className="size-4" />
                </Button>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-40 mx-auto flex max-w-lg justify-center px-4">
        <Button
          type="button"
          className="h-12 w-full shadow-lg"
          disabled={selectedCount === 0 || submitting}
          onClick={handleAddSelected}
        >
          Add {selectedCount} schedule{selectedCount === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}
