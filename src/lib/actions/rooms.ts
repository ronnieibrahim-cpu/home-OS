"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { textOrNull } from "@/lib/format";

function roomFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    floor: textOrNull(formData.get("floor")),
    description: textOrNull(formData.get("description")),
  };
}

export async function createRoom(homeId: string, formData: FormData) {
  const values = roomFromForm(formData);
  if (!values.name)
    redirect(`/homes/${homeId}/rooms/new?error=${encodeURIComponent("Name is required")}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .insert({ ...values, home_id: homeId });

  if (error)
    redirect(`/homes/${homeId}/rooms/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/homes/${homeId}`);
  redirect(`/homes/${homeId}`);
}

export async function updateRoom(roomId: string, formData: FormData) {
  const values = roomFromForm(formData);
  if (!values.name)
    redirect(`/rooms/${roomId}/edit?error=${encodeURIComponent("Name is required")}`);

  const supabase = await createClient();
  const { error } = await supabase.from("rooms").update(values).eq("id", roomId);

  if (error)
    redirect(`/rooms/${roomId}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/rooms/${roomId}`);
  redirect(`/rooms/${roomId}`);
}

export async function deleteRoom(roomId: string, homeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  if (error)
    redirect(`/rooms/${roomId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/homes/${homeId}`);
  redirect(`/homes/${homeId}`);
}
