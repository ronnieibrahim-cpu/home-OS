import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateAsset } from "@/lib/actions/assets";
import { AssetForm } from "@/components/asset-form";
import { PageHeader } from "@/components/page-header";
import { ErrorBanner } from "@/components/error-banner";
import type { Asset, Home, Room } from "@/lib/types";

export default async function EditAssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: asset }, { data: homes }, { data: rooms }] = await Promise.all([
    supabase.from("assets").select("*").eq("id", id).maybeSingle(),
    supabase.from("homes").select("*").order("created_at"),
    supabase.from("rooms").select("*").order("name"),
  ]);

  if (!asset) notFound();

  return (
    <div>
      <PageHeader title="Edit asset" backHref={`/assets/${id}`} />
      <ErrorBanner message={error} />
      <AssetForm
        action={updateAsset.bind(null, id)}
        asset={asset as Asset}
        homes={(homes ?? []) as Home[]}
        rooms={(rooms ?? []) as Room[]}
        submitLabel="Save changes"
      />
    </div>
  );
}
