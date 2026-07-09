import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { RecurringExpensesManager } from "@/components/recurring-expenses-manager";
import { ExpensesManager } from "@/components/expenses-manager";
import type { NamedRef } from "@/components/attach-select";
import type { Expense, RecurringExpense } from "@/lib/types";

export default async function ExpensesPage() {
  const supabase = await createClient();

  const [{ data: recurring }, { data: expenses }, { data: homes }, { data: assets }] =
    await Promise.all([
      supabase.from("recurring_expenses").select("*").order("name"),
      supabase
        .from("expenses")
        .select("*")
        .order("incurred_on", { ascending: false })
        .limit(50),
      supabase.from("homes").select("id, name").order("name"),
      supabase.from("assets").select("id, name").eq("status", "active").order("name"),
    ]);

  const homeRefs = (homes ?? []) as NamedRef[];
  const assetRefs = (assets ?? []) as NamedRef[];

  return (
    <div>
      <PageHeader title="Money" />

      <section className="mb-8">
        <RecurringExpensesManager
          initial={(recurring ?? []) as RecurringExpense[]}
          homes={homeRefs}
          assets={assetRefs}
        />
      </section>

      <section className="mb-4">
        <h2 className="mb-2 text-base font-semibold">Recent spending</h2>
        <ExpensesManager
          initial={(expenses ?? []) as Expense[]}
          homes={homeRefs}
          assets={assetRefs}
        />
      </section>
    </div>
  );
}
