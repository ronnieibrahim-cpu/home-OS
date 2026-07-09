import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateHome } from "@/lib/actions/homes";
import { HomeForm } from "@/components/home-form";
import { PageHeader } from "@/components/page-header";
import { ErrorBanner } from "@/components/error-banner";
import type { Home } from "@/lib/types";

export default async function EditHomePage({
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
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!home) notFound();

  return (
    <div>
      <PageHeader title="Edit home" backHref={`/homes/${id}`} />
      <ErrorBanner message={error} />
      <HomeForm
        action={updateHome.bind(null, id)}
        home={home as Home}
        submitLabel="Save changes"
      />
    </div>
  );
}
