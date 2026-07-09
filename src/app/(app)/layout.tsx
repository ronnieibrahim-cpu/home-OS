import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureHouseholdAndPerson } from "@/lib/bootstrap";
import { BottomNav } from "@/components/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await ensureHouseholdAndPerson(user);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <main className="px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
