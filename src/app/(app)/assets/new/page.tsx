import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAsset } from "@/lib/actions/assets";
import { AssetForm } from "@/components/asset-form";
import { PageHeader } from "@/components/page-header";
import { ErrorBanner } from "@/components/error-banner";
import { Button } from "@/components/ui/button";
import type { Home, Room } from "@/lib/types";

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; home?: string; room?: string }>;
}) {
  const { error, home, room } = await searchParams;
  const supabase = await createClient();

  const [{ data: homes }, { data: rooms }] = await Promise.all([
    supabase.from("homes").select("*").order("created_at"),
    supabase.from("rooms").select("*").order("name"),
  ]);

  const homeList = (homes ?? []) as Home[];

  if (homeList.length === 0) {
    return (
      <div>
        <PageHeader title="Add asset" backHref="/" />
        <div className="rounded-md border border-dashed px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Add your home first — every asset belongs to one.
          </p>
          <Button render={<Link href="/homes/new" />} className="mt-4 h-12">
            Add your home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Add asset" backHref="/assets" />
      <ErrorBanner message={error} />
      <AssetForm
        action={createAsset}
        homes={homeList}
        rooms={(rooms ?? []) as Room[]}
        defaultHomeId={home}
        defaultRoomId={room}
        submitLabel="Add asset"
      />
    </div>
  );
}
