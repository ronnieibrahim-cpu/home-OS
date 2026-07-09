import Link from "next/link";
import { notFound } from "next/navigation";
import { DoorOpen, Plus, ChevronRight, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteHome } from "@/lib/actions/homes";
import { formatCents, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ErrorBanner } from "@/components/error-banner";
import { DeleteForm } from "@/components/delete-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Asset, Home, Room } from "@/lib/types";

export default async function HomeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: home }, { data: rooms }, { data: roomlessAssets }] =
    await Promise.all([
      supabase.from("homes").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("rooms")
        .select("*, assets(count)")
        .eq("home_id", id)
        .order("name"),
      supabase
        .from("assets")
        .select("*")
        .eq("home_id", id)
        .is("room_id", null)
        .order("name"),
    ]);

  if (!home) notFound();
  const typedHome = home as Home;
  type RoomWithCount = Room & { assets: { count: number }[] };
  const roomList = (rooms ?? []) as RoomWithCount[];
  const noRoomAssets = (roomlessAssets ?? []) as Asset[];

  const address = [
    typedHome.address_line1,
    typedHome.address_line2,
    [typedHome.city, typedHome.state].filter(Boolean).join(", "),
    typedHome.postal_code,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <PageHeader
        title={typedHome.name}
        backHref="/"
        action={
          <Button render={<Link href={`/homes/${id}/edit`} />} variant="ghost" size="sm">
            <Pencil className="size-4" /> Edit
          </Button>
        }
      />
      <ErrorBanner message={error} />

      <Card className="mb-6">
        <CardContent className="grid gap-2 py-4 text-sm">
          {address && <p className="text-muted-foreground">{address}</p>}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Fact label="Purchased" value={formatDate(typedHome.purchase_date)} />
            <Fact label="Price" value={formatCents(typedHome.purchase_price_cents)} />
            <Fact label="Built" value={typedHome.year_built?.toString() ?? "—"} />
            <Fact
              label="Size"
              value={
                typedHome.square_feet
                  ? `${typedHome.square_feet.toLocaleString()} sq ft`
                  : "—"
              }
            />
          </div>
        </CardContent>
      </Card>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Rooms</h2>
          <Button render={<Link href={`/homes/${id}/rooms/new`} />} variant="outline" size="sm">
            <Plus className="size-4" /> Add room
          </Button>
        </div>
        {roomList.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No rooms yet. Add the kitchen, garage, bedrooms…
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {roomList.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="flex items-center gap-3 rounded-md border px-4 py-3 transition-colors active:bg-accent"
              >
                <DoorOpen className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{room.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {room.floor ? `${room.floor} floor · ` : ""}
                    {room.assets?.[0]?.count ?? 0} assets
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Not in a room</h2>
          <Button render={<Link href={`/assets/new?home=${id}`} />} variant="outline" size="sm">
            <Plus className="size-4" /> Add asset
          </Button>
        </div>
        {noRoomAssets.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Vehicles, gutters, the lawn — things that don&apos;t live in a room.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {noRoomAssets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </section>

      <DeleteForm
        action={deleteHome.bind(null, id)}
        label="Delete home"
        confirmMessage={`Delete "${typedHome.name}" and ALL of its rooms, assets, and their history? This cannot be undone.`}
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

function AssetRow({ asset }: { asset: Asset }) {
  return (
    <Link
      href={`/assets/${asset.id}`}
      className="flex items-center gap-3 rounded-md border px-4 py-3 transition-colors active:bg-accent"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{asset.name}</p>
        <p className="text-xs capitalize text-muted-foreground">{asset.category}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
