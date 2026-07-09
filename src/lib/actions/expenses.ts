"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dollarsToCents, textOrNull } from "@/lib/format";
import { todayISO } from "@/lib/schedule";
import {
  EXPENSE_CATEGORIES,
  RECURRING_CATEGORIES,
  RECURRING_INTERVAL_UNITS,
} from "@/lib/types";

// Actions revalidate (not redirect) and return a result object so the money
// screens can update optimistically on tap and sync in the background.
type Result = { error?: string };

async function householdId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("households")
    .select("id")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

// A blank/"none" link value means "not attached to anything".
function linkOrNull(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value : "";
  return s === "" || s === "none" ? null : s;
}

// ---------------------------------------------------------------------------
// Recurring commitments (mortgage, utilities, insurance, subscriptions…)
// ---------------------------------------------------------------------------

export async function createRecurringExpense(formData: FormData): Promise<Result> {
  const name = String(formData.get("name") ?? "").trim();
  const amount = dollarsToCents(formData.get("amount"));
  if (!name) return { error: "Name is required" };
  if (amount === null) return { error: "Amount is required" };

  const category = String(formData.get("category") ?? "other");
  const unit = String(formData.get("interval_unit") ?? "month");
  const intervalValue = parseInt(String(formData.get("interval_value") ?? "1"), 10);

  const supabase = await createClient();
  const household = await householdId(supabase);
  if (!household) return { error: "No household found" };

  const { error } = await supabase.from("recurring_expenses").insert({
    household_id: household,
    home_id: linkOrNull(formData.get("home_id")),
    asset_id: linkOrNull(formData.get("asset_id")),
    name,
    category: (RECURRING_CATEGORIES as readonly string[]).includes(category)
      ? category
      : "other",
    amount_cents: amount,
    interval_value: Number.isFinite(intervalValue) && intervalValue > 0 ? intervalValue : 1,
    interval_unit: (RECURRING_INTERVAL_UNITS as readonly string[]).includes(unit)
      ? unit
      : "month",
    starts_on: textOrNull(formData.get("starts_on")) ?? todayISO(),
    ends_on: textOrNull(formData.get("ends_on")),
  });

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/");
  return {};
}

export async function deleteRecurringExpense(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/");
  return {};
}

// ---------------------------------------------------------------------------
// One-time / actual expenses (a dated transaction)
// ---------------------------------------------------------------------------

export async function createExpense(formData: FormData): Promise<Result> {
  const description = String(formData.get("description") ?? "").trim();
  const amount = dollarsToCents(formData.get("amount"));
  if (!description) return { error: "Description is required" };
  if (amount === null) return { error: "Amount is required" };

  const category = String(formData.get("category") ?? "other");

  const supabase = await createClient();
  const household = await householdId(supabase);
  if (!household) return { error: "No household found" };

  const { error } = await supabase.from("expenses").insert({
    household_id: household,
    home_id: linkOrNull(formData.get("home_id")),
    asset_id: linkOrNull(formData.get("asset_id")),
    description,
    category: (EXPENSE_CATEGORIES as readonly string[]).includes(category)
      ? category
      : "other",
    amount_cents: amount,
    incurred_on: textOrNull(formData.get("incurred_on")) ?? todayISO(),
  });

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/");
  return {};
}

export async function deleteExpense(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/");
  return {};
}
