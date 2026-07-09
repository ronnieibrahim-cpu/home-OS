"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents, textOrNull } from "@/lib/format";
import { advanceDate, todayISO } from "@/lib/schedule";
import { MAINTENANCE_INTERVAL_UNITS } from "@/lib/types";

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
// schedule's next due date forward by one interval from today.
export async function markMaintenanceDone(scheduleId: string): Promise<Result> {
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
  });
  if (logError) return { error: logError.message };

  const nextDue = advanceDate(today, schedule.interval_value, schedule.interval_unit);
  const { error: updateError } = await supabase
    .from("maintenance_schedules")
    .update({ next_due_on: nextDue })
    .eq("id", scheduleId);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/assets/${schedule.asset_id}`);
  revalidatePath("/");
  return {};
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
