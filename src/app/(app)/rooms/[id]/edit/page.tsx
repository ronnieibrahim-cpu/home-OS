import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateRoom } from "@/lib/actions/rooms";
import { RoomForm } from "@/components/room-form";
import { PageHeader } from "@/components/page-header";
import { ErrorBanner } from "@/components/error-banner";
import type { Room } from "@/lib/types";

export default async function EditRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!room) notFound();

  return (
    <div>
      <PageHeader title="Edit room" backHref={`/rooms/${id}`} />
      <ErrorBanner message={error} />
      <RoomForm
        action={updateRoom.bind(null, id)}
        room={room as Room}
        submitLabel="Save changes"
      />
    </div>
  );
}
