"use client";

import { useOptimistic, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import {
  AttachSelect,
  applyLink,
  linkLabel,
  type NamedRef,
} from "@/components/attach-select";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";
import { dollarsToCents, formatCents, formatDate } from "@/lib/format";
import { todayISO } from "@/lib/schedule";
import { EXPENSE_CATEGORIES, type Expense } from "@/lib/types";

const selectClass =
  "h-12 w-full appearance-none rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";

type OptAction = { kind: "add"; item: Expense } | { kind: "delete"; id: string };

// One-time / actual spending — a running log of dated transactions. New rows
// appear the instant you tap "Add", then persist in the background.
export function ExpensesManager({
  initial,
  homes,
  assets,
}: {
  initial: Expense[];
  homes: NamedRef[];
  assets: NamedRef[];
}) {
  const [items, applyOptimistic] = useOptimistic(
    initial,
    (state: Expense[], action: OptAction) =>
      action.kind === "add"
        ? [action.item, ...state]
        : state.filter((e) => e.id !== action.id)
  );
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAdd(formData: FormData) {
    const description = String(formData.get("description") ?? "").trim();
    const amount = dollarsToCents(formData.get("amount"));
    if (!description) return setError("Description is required");
    if (amount === null) return setError("Amount is required");

    const { home_id, asset_id } = applyLink(formData);
    const category = String(formData.get("category") ?? "other") as Expense["category"];

    applyOptimistic({
      kind: "add",
      item: {
        id: crypto.randomUUID(),
        household_id: "",
        home_id,
        asset_id,
        recurring_expense_id: null,
        description,
        category,
        amount_cents: amount,
        incurred_on: String(formData.get("incurred_on") ?? "") || todayISO(),
      },
    });

    const res = await createExpense(formData);
    if (res?.error) {
      setError(res.error);
    } else {
      setError(null);
      formRef.current?.reset();
      setShowForm(false);
    }
  }

  function deleteAction(id: string) {
    return async () => {
      applyOptimistic({ kind: "delete", id });
      const res = await deleteExpense(id);
      if (res?.error) setError(res.error);
    };
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {items.length === 0 && !showForm ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No spending logged yet. Record a purchase or repair.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((e) => {
            const attached = linkLabel(e.home_id, e.asset_id, homes, assets);
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-md border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.description}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {e.category}
                    {attached ? ` · ${attached}` : ""}
                    {" · "}
                    <span className="normal-case">{formatDate(e.incurred_on)}</span>
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatCents(e.amount_cents)}
                </span>
                <form action={deleteAction(e.id)}>
                  <SubmitButton variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground">
                    <Trash2 className="size-4" />
                  </SubmitButton>
                </form>
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <form
          ref={formRef}
          action={handleAdd}
          className="flex flex-col gap-4 rounded-md border p-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="e_description">What was it *</Label>
            <Input
              id="e_description"
              name="description"
              required
              placeholder="New dishwasher"
              className="h-12 text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="e_amount">Amount ($) *</Label>
              <Input
                id="e_amount"
                name="amount"
                required
                inputMode="decimal"
                placeholder="899.00"
                className="h-12 text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e_category">Category</Label>
              <select id="e_category" name="category" defaultValue="purchase" className={selectClass}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="e_incurred_on">Date</Label>
            <Input
              id="e_incurred_on"
              name="incurred_on"
              type="date"
              defaultValue={todayISO()}
              className="h-12 text-base"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="link">Attach to (optional)</Label>
            <AttachSelect homes={homes} assets={assets} />
          </div>
          <div className="flex gap-2">
            <SubmitButton className="h-12 flex-1">Add expense</SubmitButton>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="h-12"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              <X className="size-5" />
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={() => setShowForm(true)}
        >
          <Plus className="size-5" /> Log expense
        </Button>
      )}
    </div>
  );
}
