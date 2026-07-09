import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ChevronRight, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteRoom } from "@/lib/actions/rooms";
import { PageHeader } from "@/components/page-header";
import { ErrorBanner } from "@/components/error-banner";
import { DeleteForm } from "@/components/delete-form";
import { Button } from "@/components/ui/button";
import type { Asset, Room } from "@/lib/types";

export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: room }, { data: assets }] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", id).maybeSingle(),
    supabase.from("assets").select("*").eq("room_id", id).order("name"),
  ]);

  if (!room) notFound();
  const typedRoom = room as Room;
  const assetList = (assets ?? []) as Asset[];

  return (
    <div>
      <PageHeader
        title={typedRoom.name}
        backHref={`/homes/${typedRoom.home_id}`}
        action={
          <Button render={<Link href={`/rooms/${id}/edit`} />} variant="ghost" size="sm">
            <Pencil className="size-4" /> Edit
          </Button>
        }
      />
      <ErrorBanner message={error} />

      {(typedRoom.floor || typedRoom.description) && (
        <p className="mb-4 text-sm text-muted-foreground">
          {typedRoom.floor ? `${typedRoom.floor} floor` : ""}
          {typedRoom.floor && typedRoom.description ? " · " : ""}
          {typedRoom.description}
        </p>
      )}

      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Assets in this room</h2>
          <Button
            render={<Link href={`/assets/new?home=${typedRoom.home_id}&room=${id}`} />}
            variant="outline"
            size="sm"
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
        {assetList.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing tracked in this room yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {assetList.map((asset) => (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}`}
                className="flex items-center gap-3 rounded-md border px-4 py-3 transition-colors active:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{asset.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {asset.category}
                    {asset.manufacturer ? ` · ${asset.manufacturer}` : ""}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <DeleteForm
        action={deleteRoom.bind(null, id, typedRoom.home_id)}
        label="Delete room"
        confirmMessage={`Delete "${typedRoom.name}"? Assets in it are kept — they just lose their room.`}
      />
    </div>
  );
}
