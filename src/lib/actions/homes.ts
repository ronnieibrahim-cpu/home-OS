"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents, intOrNull, textOrNull } from "@/lib/format";

function homeFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    address_line1: textOrNull(formData.get("address_line1")),
    address_line2: textOrNull(formData.get("address_line2")),
    city: textOrNull(formData.get("city")),
    state: textOrNull(formData.get("state")),
    postal_code: textOrNull(formData.get("postal_code")),
    country: textOrNull(formData.get("country")),
    purchase_date: textOrNull(formData.get("purchase_date")),
    purchase_price_cents: dollarsToCents(formData.get("purchase_price")),
    year_built: intOrNull(formData.get("year_built")),
    square_feet: intOrNull(formData.get("square_feet")),
  };
}

export async function createHome(householdId: string, formData: FormData) {
  const values = homeFromForm(formData);
  if (!values.name) redirect(`/homes/new?error=${encodeURIComponent("Name is required")}`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homes")
    .insert({ ...values, household_id: householdId })
    .select("id")
    .single();

  if (error) redirect(`/homes/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  redirect(`/homes/${data.id}`);
}

export async function updateHome(homeId: string, formData: FormData) {
  const values = homeFromForm(formData);
  if (!values.name)
    redirect(`/homes/${homeId}/edit?error=${encodeURIComponent("Name is required")}`);

  const supabase = await createClient();
  const { error } = await supabase.from("homes").update(values).eq("id", homeId);

  if (error)
    redirect(`/homes/${homeId}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  revalidatePath(`/homes/${homeId}`);
  redirect(`/homes/${homeId}`);
}

export async function deleteHome(homeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("homes").delete().eq("id", homeId);
  if (error)
    redirect(`/homes/${homeId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  redirect("/");
}
