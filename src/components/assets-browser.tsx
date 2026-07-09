"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ASSET_CATEGORIES, type Asset } from "@/lib/types";

type AssetWithRoom = Asset & { rooms: { name: string } | null };

// The whole asset list is loaded once on the server and filtered here in the
// browser, so tapping a category chip is instant — no navigation, no database
// round-trip. The URL is kept in sync via history.replaceState purely so a
// refresh or share preserves the filter; it never triggers a re-render.
export function AssetsBrowser({
  assets,
  initialCategory,
}: {
  assets: AssetWithRoom[];
  initialCategory?: string;
}) {
  const [category, setCategory] = useState<string | null>(
    initialCategory && (ASSET_CATEGORIES as readonly string[]).includes(initialCategory)
      ? initialCategory
      : null
  );

  const visible = category ? assets.filter((a) => a.category === category) : assets;

  function select(next: string | null) {
    setCategory(next);
    window.history.replaceState(null, "", next ? `/assets?category=${next}` : "/assets");
  }

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <Chip label="All" active={!category} onSelect={() => select(null)} />
        {ASSET_CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={c[0].toUpperCase() + c.slice(1)}
            active={category === c}
            onSelect={() => select(c)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {category
            ? `No ${category} assets yet.`
            : "Nothing tracked yet. Add your first asset."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((asset) => (
            <Link
              key={asset.id}
              href={`/assets/${asset.id}`}
              className={cn(
                "flex items-center gap-3 rounded-md border px-4 py-3 transition-colors active:bg-accent",
                asset.status === "disposed" && "opacity-50"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{asset.name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="capitalize">{asset.category}</span>
                  {asset.rooms?.name ? ` · ${asset.rooms.name}` : ""}
                  {asset.purchase_price_cents != null
                    ? ` · ${formatCents(asset.purchase_price_cents)}`
                    : ""}
                  {asset.status === "disposed" ? " · disposed" : ""}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

// A plain button (not a link) so the tap fires immediately with no routing.
function Chip({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors active:opacity-70",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}
