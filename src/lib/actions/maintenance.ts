"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents, textOrNull } from "@/lib/format";
import { advanceDate, todayISO } from "@/lib/schedule";
import { MAINTENANCE_INTERVAL_UNITS } from "@/lib/types";
import type { AssetKnowledgeDetails, SuggestedSchedule } from "@/lib/knowledge/pack";

// These actions revalidate (not redirect) and return a plain result object, so
// the optimistic client components can update the screen on tap and reconcile
// with the server in the background. On failure the client rolls back and
// surfaces `error`.
type Result = { error?: string };

function scheduleFromForm(formData: FormData) {
  const unit = String(formData.get("interval_unit") ?? "month");
  const intervalValue = parseInt(String(formData.get("interval_value") ?? "1"), 10);
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: textOrNull(formData.get("description")),
    interval_value: Number.isFinite(intervalValue) && intervalValue > 0 ? intervalValue : 1,
    interval_unit: (MAINTENANCE_INTERVAL_UNITS as readonly string[]).includes(unit)
      ? unit
      : "month",
    next_due_on: textOrNull(formData.get("next_due_on")),
    estimated_cost_cents: dollarsToCents(formData.get("estimated_cost")),
    is_active: true,
  };
}

export async function createMaintenanceSchedule(
  assetId: string,
  formData: FormData
): Promise<Result> {
  const values = scheduleFromForm(formData);
  if (!values.name) return { error: "Name is required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_schedules")
    .insert({ ...values, asset_id: assetId });

  if (error) return { error: error.message };
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/");
  return {};
}

// Record that the work happened today: append a service log and push the
// schedule's next due date forward by one interval from today. An optional
// odometer reading (vehicles) is stored on the log and, if it's newer/higher
// than what's on file, also bumps the asset's tracked current mileage — a
// reading captured at a real service is more trustworthy than a manually
// typed one (see docs/decisions.md ADR-014).
export async function markMaintenanceDone(
  scheduleId: string,
  mileage?: number | null
): Promise<Result> {
  const supabase = await createClient();

  const { data: schedule, error: readError } = await supabase
    .from("maintenance_schedules")
    .select("asset_id, interval_value, interval_unit")
    .eq("id", scheduleId)
    .maybeSingle();

  if (readError || !schedule) return { error: readError?.message ?? "Schedule not found" };

  const today = todayISO();
  const { error: logError } = await supabase.from("maintenance_logs").insert({
    asset_id: schedule.asset_id,
    schedule_id: scheduleId,
    completed_on: today,
    mileage: mileage ?? null,
  });
  if (logError) return { error: logError.message };

  const nextDue = advanceDate(today, schedule.interval_value, schedule.interval_unit);
  const { error: updateError } = await supabase
    .from("maintenance_schedules")
    .update({ next_due_on: nextDue })
    .eq("id", scheduleId);
  if (updateError) return { error: updateError.message };

  if (mileage != null) {
    const { data: asset } = await supabase
      .from("assets")
      .select("details")
      .eq("id", schedule.asset_id)
      .maybeSingle();
    const details = (asset?.details ?? {}) as AssetKnowledgeDetails;
    if (details.current_mileage == null || mileage > details.current_mileage) {
      await supabase
        .from("assets")
        .update({ details: { ...details, current_mileage: mileage, current_mileage_asof: today } })
        .eq("id", schedule.asset_id);
    }
  }

  revalidatePath(`/assets/${schedule.asset_id}`);
  revalidatePath("/");
  return {};
}

// One-tap-accept a knowledge-pack suggestion: insert it as a real schedule
// with today + the suggestion's interval as the first due date.
export async function acceptMaintenanceSuggestion(
  assetId: string,
  suggestion: SuggestedSchedule
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_schedules").insert({
    asset_id: assetId,
    name: suggestion.name,
    description: suggestion.description,
    interval_value: suggestion.intervalValue,
    interval_unit: suggestion.intervalUnit,
    interval_miles: suggestion.intervalMiles,
    next_due_on: advanceDate(todayISO(), suggestion.intervalValue, suggestion.intervalUnit),
    estimated_cost_cents: suggestion.estimatedCostMidCents,
    is_active: true,
  });

  if (error) return { error: error.message };
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets/suggestions");
  revalidatePath("/");
  return {};
}

// Bulk-accept suggestions across many assets from the review screen.
export async function acceptMaintenanceSuggestionsBulk(
  items: { assetId: string; suggestion: SuggestedSchedule }[]
): Promise<Result & { addedCount?: number }> {
  if (items.length === 0) return {};
  const supabase = await createClient();
  const today = todayISO();
  const rows = items.map(({ assetId, suggestion }) => ({
    asset_id: assetId,
    name: suggestion.name,
    description: suggestion.description,
    interval_value: suggestion.intervalValue,
    interval_unit: suggestion.intervalUnit,
    interval_miles: suggestion.intervalMiles,
    next_due_on: advanceDate(today, suggestion.intervalValue, suggestion.intervalUnit),
    estimated_cost_cents: suggestion.estimatedCostMidCents,
    is_active: true,
  }));

  const { error } = await supabase.from("maintenance_schedules").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/assets/suggestions");
  for (const assetId of new Set(items.map((i) => i.assetId))) {
    revalidatePath(`/assets/${assetId}`);
  }
  revalidatePath("/");
  return { addedCount: rows.length };
}

export async function deleteMaintenanceSchedule(
  scheduleId: string,
  assetId: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_schedules")
    .delete()
    .eq("id", scheduleId);

  if (error) return { error: error.message };
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/");
  return {};
}
