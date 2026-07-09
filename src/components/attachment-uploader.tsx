"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ATTACHMENT_KINDS, type AttachmentKind } from "@/lib/types";

const selectClass =
  "h-12 w-full appearance-none rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// Uploads a file to the private 'attachments' bucket, then records it in the
// attachments table pointing at this asset (entity_type = 'assets').
export function AttachmentUploader({ assetId }: { assetId: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<AttachmentKind>("photo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `assets/${assetId}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(storagePath, file, { contentType: file.type || undefined });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setBusy(false);
      return;
    }

    const { error: insertError } = await supabase.from("attachments").insert({
      entity_type: "assets",
      entity_id: assetId,
      bucket: "attachments",
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      kind,
    });

    if (insertError) {
      // Don't leave an orphaned file if the row insert failed.
      await supabase.storage.from("attachments").remove([storagePath]);
      setError(`Could not save attachment: ${insertError.message}`);
      setBusy(false);
      return;
    }

    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as AttachmentKind)}
          className={selectClass + " flex-1"}
          aria-label="Attachment type"
          disabled={busy}
        >
          {ATTACHMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {k[0].toUpperCase() + k.slice(1)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="lg"
          className="h-12"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Camera className="size-5" />
          )}
          {busy ? "Uploading…" : "Add file"}
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
        }}
      />
    </div>
  );
}
