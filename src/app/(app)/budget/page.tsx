import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { BudgetView } from "@/components/budget-view";
import { buildCurrentBudget } from "@/lib/budget/current-budget";
import { projectForecast } from "@/lib/budget/forecast";
import { SCENARIO_DEFAULTS } from "@/lib/budget/mortgage";
import { todayISO } from "@/lib/schedule";
import type { Asset, Expense, Home, MaintenanceSchedule, RecurringExpense } from "@/lib/types";

// Trailing window (months) of actual expenses used to average "extras".
const ACTUALS_MONTHS = 12;

function monthsAgoISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const idx = m - 1 - months;
  const year = y + Math.floor(idx / 12);
  const month = ((idx % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

export default async function BudgetPage() {
  const supabase = await createClient();
  const asOf = todayISO();
  // Pull one extra month so the trailing-average window is fully covered.
  const expenseCutoff = monthsAgoISO(asOf, ACTUALS_MONTHS + 1);

  const [{ data: recurring }, { data: schedules }, { data: expenses }, { data: assets }, { data: homes }] =
    await Promise.all([
      supabase.from("recurring_expenses").select("*"),
      supabase.from("maintenance_schedules").select("*").eq("is_active", true),
      supabase.from("expenses").select("*").gte("incurred_on", expenseCutoff),
      supabase
        .from("assets")
        .select(
          "name, category, manufacturer, model_number, details, purchase_date, status"
        )
        .eq("status", "active"),
      supabase
        .from("homes")
        .select("purchase_price_cents")
        .order("created_at")
        .limit(1),
    ]);

  const recurringList = (recurring ?? []) as RecurringExpense[];
  const scheduleList = (schedules ?? []) as MaintenanceSchedule[];
  const expenseList = (expenses ?? []) as Expense[];
  const assetList = (assets ?? []) as Pick<
    Asset,
    "name" | "category" | "manufacturer" | "model_number" | "details" | "purchase_date" | "status"
  >[];

  const currentBudget = buildCurrentBudget({
    recurring: recurringList,
    schedules: scheduleList,
    expenses: expenseList,
    asOfISO: asOf,
    actualsMonths: ACTUALS_MONTHS,
  });

  const forecast = projectForecast({
    recurring: recurringList,
    schedules: scheduleList,
    assets: assetList,
    asOfISO: asOf,
    months: 24,
  });

  const homePrice = (homes ?? [])[0] as Pick<Home, "purchase_price_cents"> | undefined;
  const seedPriceCents = homePrice?.purchase_price_cents ?? SCENARIO_DEFAULTS.priceCents;

  return (
    <div>
      <PageHeader title="Budget & forecast" />
      <BudgetView
        currentBudget={currentBudget}
        forecast={forecast}
        seedPriceCents={seedPriceCents}
      />
    </div>
  );
}
