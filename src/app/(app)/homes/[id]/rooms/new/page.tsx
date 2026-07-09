import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createRoom } from "@/lib/actions/rooms";
import { RoomForm } from "@/components/room-form";
import { PageHeader } from "@/components/page-header";
import { ErrorBanner } from "@/components/error-banner";

export default async function NewRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: home } = await supabase
    .from("homes")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!home) notFound();

  return (
    <div>
      <PageHeader title={`Add room to ${home.name}`} backHref={`/homes/${id}`} />
      <ErrorBanner message={error} />
      <RoomForm action={createRoom.bind(null, id)} submitLabel="Add room" />
    </div>
  );
}
