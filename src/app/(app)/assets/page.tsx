import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ASSET_CATEGORIES, type Asset } from "@/lib/types";

type AssetWithRoom = Asset & { rooms: { name: string } | null };

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("assets")
    .select("*, rooms(name)")
    .order("name");
  if (category && (ASSET_CATEGORIES as readonly string[]).includes(category)) {
    query = query.eq("category", category);
  }
  const { data: assets } = await query;
  const assetList = (assets ?? []) as AssetWithRoom[];

  return (
    <div>
      <PageHeader
        title="Assets"
        action={
          <Button render={<Link href="/assets/new" />} size="sm">
            <Plus className="size-4" /> Add
          </Button>
        }
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <FilterChip href="/assets" label="All" active={!category} />
        {ASSET_CATEGORIES.map((c) => (
          <FilterChip
            key={c}
            href={`/assets?category=${c}`}
            label={c[0].toUpperCase() + c.slice(1)}
            active={category === c}
          />
        ))}
      </div>

      {assetList.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {category ? `No ${category} assets yet.` : "Nothing tracked yet. Add your first asset."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {assetList.map((asset) => (
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
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-sm",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground"
      )}
    >
      {label}
    </Link>
  );
}
