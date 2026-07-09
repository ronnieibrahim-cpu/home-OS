import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createHome } from "@/lib/actions/homes";
import { HomeForm } from "@/components/home-form";
import { PageHeader } from "@/components/page-header";
import { ErrorBanner } from "@/components/error-banner";

export default async function NewHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: household } = await supabase
    .from("households")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!household) redirect("/");

  return (
    <div>
      <PageHeader title="Add home" backHref="/" />
      <ErrorBanner message={error} />
      <HomeForm action={createHome.bind(null, household.id)} submitLabel="Add home" />
    </div>
  );
}
