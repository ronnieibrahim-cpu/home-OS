"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents, textOrNull } from "@/lib/format";
import { ASSET_CATEGORIES } from "@/lib/types";
import type { AssetKnowledgeDetails } from "@/lib/knowledge/pack";

type Result = { error?: string };

function assetFromForm(formData: FormData) {
  const category = String(formData.get("category") ?? "other");
  const roomId = String(formData.get("room_id") ?? "");
  return {
    name: String(formData.get("name") ?? "").trim(),
    home_id: String(formData.get("home_id") ?? ""),
    room_id: roomId === "" || roomId === "none" ? null : roomId,
    category: (ASSET_CATEGORIES as readonly string[]).includes(category)
      ? category
      : "other",
    manufacturer: textOrNull(formData.get("manufacturer")),
    model_number: textOrNull(formData.get("model_number")),
    serial_number: textOrNull(formData.get("serial_number")),
    purchase_date: textOrNull(formData.get("purchase_date")),
    purchase_price_cents: dollarsToCents(formData.get("purchase_price")),
    status: formData.get("status") === "disposed" ? "disposed" : "active",
  };
}

export async function createAsset(formData: FormData) {
  const values = assetFromForm(formData);
  if (!values.name || !values.home_id)
    redirect(`/assets/new?error=${encodeURIComponent("Name and home are required")}`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .insert(values)
    .select("id")
    .single();

  if (error) redirect(`/assets/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/assets");
  redirect(`/assets/${data.id}`);
}

export async function updateAsset(assetId: string, formData: FormData) {
  const values = assetFromForm(formData);
  if (!values.name || !values.home_id)
    redirect(`/assets/${assetId}/edit?error=${encodeURIComponent("Name and home are required")}`);

  const supabase = await createClient();
  const { error } = await supabase.from("assets").update(values).eq("id", assetId);

  if (error)
    redirect(`/assets/${assetId}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  redirect(`/assets/${assetId}`);
}

export async function deleteAsset(assetId: string) {
  const supabase = await createClient();

  // Remove storage objects for this asset's attachments first — SQL triggers
  // clean up the attachment rows, but cannot delete files (ADR-004).
  const { data: attachments } = await supabase
    .from("attachments")
    .select("bucket, storage_path")
    .eq("entity_type", "assets")
    .eq("entity_id", assetId);

  if (attachments && attachments.length > 0) {
    await supabase.storage
      .from("attachments")
      .remove(attachments.map((a) => a.storage_path));
  }

  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error)
    redirect(`/assets/${assetId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/assets");
  redirect("/assets");
}

// Merges a patch into the free-form `assets.details` JSONB column. Used by the
// knowledge-pack UI to store the confirmed/overridden subtype, dismissed
// suggestion keys, and replacement-estimate edits — all without a schema
// change (see docs/decisions.md ADR-010). Revalidates instead of redirecting
// so the calling component can update optimistically.
export async function updateAssetKnowledgeDetails(
  assetId: string,
  patch: Partial<AssetKnowledgeDetails>
): Promise<Result> {
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("assets")
    .select("details")
    .eq("id", assetId)
    .maybeSingle();
  if (readError || !current) return { error: readError?.message ?? "Asset not found" };

  const merged = { ...(current.details ?? {}), ...patch };
  const { error } = await supabase.from("assets").update({ details: merged }).eq("id", assetId);
  if (error) return { error: error.message };

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets/suggestions");
  return {};
}

export async function dismissMaintenanceSuggestion(
  assetId: string,
  suggestionKey: string,
  currentDismissed: string[]
): Promise<Result> {
  return updateAssetKnowledgeDetails(assetId, {
    dismissed_suggestions: [...currentDismissed, suggestionKey],
  });
}
