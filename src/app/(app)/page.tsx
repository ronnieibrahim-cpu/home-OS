import Link from "next/link";
import { House, Plus, ChevronRight, Wallet, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { formatCents } from "@/lib/format";
import { todayISO } from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  UpcomingMaintenance,
  type UpcomingSchedule,
} from "@/components/upcoming-maintenance";
import type { Home } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: household }, { data: monthly }, { data: upcoming }, { data: homes }] =
    await Promise.all([
      supabase.from("households").select("name").limit(1).maybeSingle(),
      supabase.from("v_monthly_recurring_costs").select("monthly_cents"),
      supabase
        .from("maintenance_schedules")
        .select("*, assets(name)")
        .eq("is_active", true)
        .not("next_due_on", "is", null)
        .order("next_due_on", { ascending: true })
        .limit(6),
      supabase.from("homes").select("*, rooms(count), assets(count)").order("created_at"),
    ]);

  const monthlyTotal = (monthly ?? []).reduce(
    (sum, r: { monthly_cents: number | null }) => sum + (r.monthly_cents ?? 0),
    0
  );
  const upcomingList = (upcoming ?? []) as UpcomingSchedule[];
  const overdueCount = upcomingList.filter(
    (s) => s.next_due_on !== null && s.next_due_on < today
  ).length;

  type HomeWithCounts = Home & { rooms: { count: number }[]; assets: { count: number }[] };
  const homeList = (homes ?? []) as HomeWithCounts[];

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {household?.name ?? "Household OS"}
          </h1>
          <p className="text-sm text-muted-foreground">Your household at a glance</p>
        </div>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground">
            Sign out
          </Button>
        </form>
      </header>

      {/* Monthly cost hero */}
      <Link href="/expenses" className="mb-6 block">
        <Card className="transition-colors active:bg-accent">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="size-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">Recurring cost of living</p>
              <p className="text-3xl font-semibold tabular-nums">
                {formatCents(monthlyTotal)}
                <span className="text-base font-normal text-muted-foreground">/mo</span>
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {/* Upcoming maintenance */}
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Wrench className="size-4 text-muted-foreground" /> Upcoming maintenance
          </h2>
          {overdueCount > 0 && (
            <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
              {overdueCount} overdue
            </span>
          )}
        </div>
        {upcomingList.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing scheduled. Add maintenance to an asset to see it here.
          </p>
        ) : (
          <UpcomingMaintenance initial={upcomingList} />
        )}
      </section>

      {/* Homes */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
          <House className="size-4 text-muted-foreground" /> Homes
        </h2>
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
      </section>
    </div>
  );
}
