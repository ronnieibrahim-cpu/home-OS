import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AssetsBrowser } from "@/components/assets-browser";
import { Button } from "@/components/ui/button";
import type { Asset } from "@/lib/types";

type AssetWithRoom = Asset & { rooms: { name: string } | null };

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  // Load every asset once; filtering happens instantly in the client.
  const { data: assets } = await supabase
    .from("assets")
    .select("*, rooms(name)")
    .order("name");

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
      <AssetsBrowser
        assets={(assets ?? []) as AssetWithRoom[]}
        initialCategory={category}
      />
    </div>
  );
}
