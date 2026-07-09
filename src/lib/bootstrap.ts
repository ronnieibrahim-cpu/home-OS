import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

// First-run setup: make sure the household row exists and the logged-in
// user has a people row. Idempotent; runs on every app layout render but
// only writes the first time each user signs in.
export async function ensureHouseholdAndPerson(user: User): Promise<string> {
  const supabase = await createClient();

  let { data: household } = await supabase
    .from("households")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!household) {
    const { data: created, error } = await supabase
      .from("households")
      .insert({ name: "Our Household" })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create household: ${error.message}`);
    household = created;
  }

  const { data: person } = await supabase
    .from("people")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!person) {
    const name = user.email ? user.email.split("@")[0] : "Member";
    await supabase.from("people").insert({
      household_id: household.id,
      user_id: user.id,
      name,
    });
  }

  return household.id;
}
