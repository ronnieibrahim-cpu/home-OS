import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteAsset } from "@/lib/actions/assets";
import { deleteAttachment } from "@/lib/actions/attachments";
import { formatCents, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ErrorBanner } from "@/components/error-banner";
import { DeleteForm } from "@/components/delete-form";
import { AttachmentUploader } from "@/components/attachment-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Asset, Attachment } from "@/lib/types";

type AssetJoined = Asset & {
  homes: { name: string } | null;
  rooms: { name: string } | null;
};

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: asset }, { data: attachments }] = await Promise.all([
    supabase
      .from("assets")
      .select("*, homes(name), rooms(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", "assets")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!asset) notFound();
  const typedAsset = asset as AssetJoined;
  const attachmentList = (attachments ?? []) as Attachment[];

  // Private bucket -> short-lived signed URLs for display.
  const signedUrls = new Map<string, string>();
  if (attachmentList.length > 0) {
    const { data: signed } = await supabase.storage
      .from("attachments")
      .createSignedUrls(
        attachmentList.map((a) => a.storage_path),
        60 * 60
      );
    signed?.forEach((s, i) => {
      if (s.signedUrl) signedUrls.set(attachmentList[i].id, s.signedUrl);
    });
  }

  const photos = attachmentList.filter((a) => a.mime_type?.startsWith("image/"));
  const files = attachmentList.filter((a) => !a.mime_type?.startsWith("image/"));

  return (
    <div>
      <PageHeader
        title={typedAsset.name}
        backHref="/assets"
        action={
          <Button render={<Link href={`/assets/${id}/edit`} />} variant="ghost" size="sm">
            <Pencil className="size-4" /> Edit
          </Button>
        }
      />
      <ErrorBanner message={error} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="capitalize">
          {typedAsset.category}
        </Badge>
        {typedAsset.status === "disposed" && <Badge variant="outline">Disposed</Badge>}
        <span className="text-sm text-muted-foreground">
          {typedAsset.homes?.name}
          {typedAsset.rooms?.name ? ` · ${typedAsset.rooms.name}` : ""}
        </span>
      </div>

      <Card className="mb-6">
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 py-4 text-sm">
          <Fact label="Manufacturer" value={typedAsset.manufacturer ?? "—"} />
          <Fact label="Model" value={typedAsset.model_number ?? "—"} />
          <Fact label="Serial" value={typedAsset.serial_number ?? "—"} />
          <Fact label="Purchased" value={formatDate(typedAsset.purchase_date)} />
          <Fact label="Price" value={formatCents(typedAsset.purchase_price_cents)} />
        </CardContent>
      </Card>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold">Photos & receipts</h2>
        <AttachmentUploader assetId={id} />

        {photos.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {photos.map((a) => {
              const url = signedUrls.get(a.id);
              return (
                <figure key={a.id} className="relative">
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer">
                      {/* Signed URLs are per-project dynamic hosts; plain img keeps config simple. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={a.title ?? a.file_name}
                        className="aspect-square w-full rounded-md border object-cover"
                      />
                    </a>
                  )}
                  <figcaption className="mt-1 flex items-center justify-between gap-1">
                    <span className="truncate text-xs capitalize text-muted-foreground">
                      {a.kind}
                    </span>
                    <DeleteAttachmentButton attachmentId={a.id} assetId={id} />
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {files.map((a) => {
              const url = signedUrls.get(a.id);
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-md border px-4 py-3"
                >
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                      >
                        {a.title ?? a.file_name}
                      </a>
                    ) : (
                      <span className="block truncate text-sm">{a.file_name}</span>
                    )}
                    <span className="text-xs capitalize text-muted-foreground">
                      {a.kind} · {formatDate(a.created_at.slice(0, 10))}
                    </span>
                  </div>
                  <DeleteAttachmentButton attachmentId={a.id} assetId={id} />
                </div>
              );
            })}
          </div>
        )}

        {attachmentList.length === 0 && (
          <p className="mt-3 rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No photos or receipts yet. Snap the receipt, the label with the
            serial number, the manual…
          </p>
        )}
      </section>

      <DeleteForm
        action={deleteAsset.bind(null, id)}
        label="Delete asset"
        confirmMessage={`Delete "${typedAsset.name}" and its photos, receipts, and maintenance history? If you sold or trashed it, mark it Disposed instead (Edit → Status).`}
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

function DeleteAttachmentButton({
  attachmentId,
  assetId,
}: {
  attachmentId: string;
  assetId: string;
}) {
  return (
    <form action={deleteAttachment.bind(null, attachmentId, `/assets/${assetId}`)}>
      <button
        type="submit"
        className="text-xs text-destructive underline-offset-2 hover:underline"
      >
        Remove
      </button>
    </form>
  );
}
