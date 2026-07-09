"use client";

import { useOptimistic, useState } from "react";
import { MaintenanceRow } from "@/components/maintenance-row";
import { markMaintenanceDone } from "@/lib/actions/maintenance";
import { advanceDate, todayISO } from "@/lib/schedule";
import type { MaintenanceSchedule } from "@/lib/types";

export type UpcomingSchedule = MaintenanceSchedule & {
  assets: { name: string } | null;
};

// Dashboard list of what's due soon across every asset. Tapping "Done" pushes
// the due date forward instantly, then syncs (and the item drops off on the
// next server refresh once it's no longer imminent).
export function UpcomingMaintenance({ initial }: { initial: UpcomingSchedule[] }) {
  const [schedules, applyOptimistic] = useOptimistic(
    initial,
    (state: UpcomingSchedule[], done: { id: string; nextDue: string }) =>
      state.map((s) =>
        s.id === done.id ? { ...s, next_due_on: done.nextDue } : s
      )
  );
  const [error, setError] = useState<string | null>(null);

  function doneAction(schedule: UpcomingSchedule) {
    return async () => {
      const nextDue = advanceDate(
        todayISO(),
        schedule.interval_value,
        schedule.interval_unit
      );
      applyOptimistic({ id: schedule.id, nextDue });
      const res = await markMaintenanceDone(schedule.id);
      if (res?.error) setError(res.error);
    };
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {schedules.map((s) => (
        <MaintenanceRow
          key={s.id}
          schedule={s}
          assetName={s.assets?.name}
          assetHref={`/assets/${s.asset_id}`}
          doneAction={doneAction(s)}
        />
      ))}
    </div>
  );
}
