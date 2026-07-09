import Link from "next/link";
import { House, Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Home } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: household }, { data: homes }, { count: assetCount }] =
    await Promise.all([
      supabase.from("households").select("name").limit(1).maybeSingle(),
      supabase.from("homes").select("*, rooms(count), assets(count)").order("created_at"),
      supabase.from("assets").select("*", { count: "exact", head: true }),
    ]);

  type HomeWithCounts = Home & { rooms: { count: number }[]; assets: { count: number }[] };
  const homeList = (homes ?? []) as HomeWithCounts[];

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {household?.name ?? "Household OS"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {assetCount ?? 0} asset{assetCount === 1 ? "" : "s"} tracked
          </p>
        </div>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground">
            Sign out
          </Button>
        </form>
      </header>

      {homeList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <House className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Start with your home</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your house first — rooms and everything you own hang off it.
              </p>
            </div>
            <Button render={<Link href="/homes/new" />} size="lg" className="h-12">
              <Plus className="size-5" /> Add your home
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {homeList.map((home) => (
            <Link key={home.id} href={`/homes/${home.id}`}>
              <Card className="transition-colors active:bg-accent">
                <CardContent className="flex items-center gap-4 py-4">
                  <House className="size-8 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{home.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {home.rooms?.[0]?.count ?? 0} rooms · {home.assets?.[0]?.count ?? 0} assets
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
          <Button render={<Link href="/homes/new" />} variant="outline" className="h-12">
            <Plus className="size-5" /> Add another home
          </Button>
        </div>
      )}
    </div>
  );
}
