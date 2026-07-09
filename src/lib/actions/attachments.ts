"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Deletes the storage object first, then the row (ADR-004: SQL can't reach
// Storage, so the app owns file deletion).
export async function deleteAttachment(attachmentId: string, pathToRevalidate: string) {
  const supabase = await createClient();

  const { data: attachment } = await supabase
    .from("attachments")
    .select("bucket, storage_path")
    .eq("id", attachmentId)
    .single();

  if (attachment) {
    await supabase.storage.from(attachment.bucket).remove([attachment.storage_path]);
    await supabase.from("attachments").delete().eq("id", attachmentId);
  }

  revalidatePath(pathToRevalidate);
}
