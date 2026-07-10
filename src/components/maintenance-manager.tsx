"use client";

import { useOptimistic, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { MaintenanceRow } from "@/components/maintenance-row";
import {
  createMaintenanceSchedule,
  deleteMaintenanceSchedule,
  markMaintenanceDone,
} from "@/lib/actions/maintenance";
import { advanceDate, todayISO } from "@/lib/schedule";
import { MAINTENANCE_INTERVAL_UNITS, type MaintenanceSchedule } from "@/lib/types";
import type { EffectiveDue } from "@/lib/vehicles/mileage";

const selectClass =
  "h-12 w-full appearance-none rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";

type OptAction =
  | { kind: "add"; item: MaintenanceSchedule }
  | { kind: "delete"; id: string }
  | { kind: "done"; id: string; nextDue: string };

// Maintenance schedules for a single asset. Adding, completing, and deleting
// all update the list optimistically (instant on tap) and then sync to the DB.
export function MaintenanceManager({
  assetId,
  initial,
  isVehicle = false,
  dueOverrides = {},
}: {
  assetId: string;
  initial: MaintenanceSchedule[];
  isVehicle?: boolean;
  dueOverrides?: Record<string, EffectiveDue>;
}) {
  const [schedules, applyOptimistic] = useOptimistic(
    initial,
    (state: MaintenanceSchedule[], action: OptAction) => {
      switch (action.kind) {
        case "add":
          return [...state, action.item].sort(byDue);
        case "delete":
          return state.filter((s) => s.id !== action.id);
        case "done":
          return state
            .map((s) => (s.id === action.id ? { ...s, next_due_on: action.nextDue } : s))
            .sort(byDue);
      }
    }
  );
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAdd(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      setError("Name is required");
      return;
    }
    const intervalValue =
      parseInt(String(formData.get("interval_value") ?? "1"), 10) || 1;
    const unit = String(formData.get("interval_unit") ?? "month") as
      MaintenanceSchedule["interval_unit"];
    const estRaw = String(formData.get("estimated_cost") ?? "").replace(/[$,\s]/g, "");
    const est = estRaw === "" ? null : Math.round(Number(estRaw) * 100);

    applyOptimistic({
      kind: "add",
      item: {
        id: crypto.randomUUID(),
        asset_id: assetId,
        name,
        description: null,
        interval_value: intervalValue,
        interval_unit: unit,
        interval_miles: null,
        next_due_on: String(formData.get("next_due_on") ?? "") || null,
        estimated_cost_cents: est !== null && Number.isFinite(est) ? est : null,
        is_active: true,
      },
    });

    const res = await createMaintenanceSchedule(assetId, formData);
    if (res?.error) {
      setError(res.error);
    } else {
      setError(null);
      formRef.current?.reset();
      setShowForm(false);
    }
  }

  function doneAction(schedule: MaintenanceSchedule) {
    return async (formData: FormData) => {
      const mileageRaw = String(formData.get("mileage") ?? "").trim();
      const mileageValue = mileageRaw === "" ? null : parseInt(mileageRaw, 10);
      const mileage = mileageValue != null && Number.isFinite(mileageValue) ? mileageValue : null;

      const nextDue = advanceDate(
        todayISO(),
        schedule.interval_value,
        schedule.interval_unit
      );
      applyOptimistic({ kind: "done", id: schedule.id, nextDue });
      const res = await markMaintenanceDone(schedule.id, mileage);
      if (res?.error) setError(res.error);
    };
  }

  function deleteAction(id: string) {
    return async () => {
      applyOptimistic({ kind: "delete", id });
      const res = await deleteMaintenanceSchedule(id, assetId);
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

      {schedules.length === 0 && !showForm ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No maintenance scheduled. Add filter changes, oil changes, gutter
          cleaning…
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {schedules.map((s) => (
            <MaintenanceRow
              key={s.id}
              schedule={s}
              vehicle={isVehicle}
              dueOverride={dueOverrides[s.id]}
              doneAction={doneAction(s)}
              deleteAction={deleteAction(s.id)}
            />
          ))}
        </div>
      )}

      {showForm ? (
        <form
          ref={formRef}
          action={handleAdd}
          className="flex flex-col gap-4 rounded-md border p-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="m_name">What needs doing *</Label>
            <Input
              id="m_name"
              name="name"
              required
              placeholder="Replace HVAC filter"
              className="h-12 text-base"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="m_interval_value">Every</Label>
              <Input
                id="m_interval_value"
                name="interval_value"
                type="number"
                min={1}
                defaultValue={3}
                inputMode="numeric"
                className="h-12 text-base"
              />
            </div>
            <div className="col-span-2 grid gap-2">
              <Label htmlFor="m_interval_unit">Unit</Label>
              <select
                id="m_interval_unit"
                name="interval_unit"
                defaultValue="month"
                className={selectClass}
              >
                {MAINTENANCE_INTERVAL_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u[0].toUpperCase() + u.slice(1)}s
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="m_next_due_on">Next due</Label>
              <Input
                id="m_next_due_on"
                name="next_due_on"
                type="date"
                defaultValue={todayISO()}
                className="h-12 text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m_estimated_cost">Est. cost ($)</Label>
              <Input
                id="m_estimated_cost"
                name="estimated_cost"
                inputMode="decimal"
                placeholder="25.00"
                className="h-12 text-base"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <SubmitButton className="h-12 flex-1">Add schedule</SubmitButton>
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
          <Plus className="size-5" /> Add maintenance schedule
        </Button>
      )}
    </div>
  );
}

function byDue(a: MaintenanceSchedule, b: MaintenanceSchedule): number {
  if (!a.next_due_on) return 1;
  if (!b.next_due_on) return -1;
  return a.next_due_on.localeCompare(b.next_due_on);
}
