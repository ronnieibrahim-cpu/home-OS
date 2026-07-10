"use client";

import Link from "next/link";
import { Check, Trash2, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { formatCents } from "@/lib/format";
import { describeInterval, dueInfo, type DueTone } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { MaintenanceSchedule } from "@/lib/types";
import type { EffectiveDue } from "@/lib/vehicles/mileage";

const toneClasses: Record<DueTone, string> = {
  overdue: "text-destructive",
  soon: "text-amber-600 dark:text-amber-500",
  ok: "text-muted-foreground",
};

// One maintenance schedule as a row: what/when/cost plus a "Done" button and an
// optional delete. The mutating buttons are <form>s so React runs them inside a
// transition — the parent's optimistic state updates the instant they're tapped.
// When a vehicle schedule has a mileage-based cadence, the effective due date
// is whichever of time or mileage comes first — shown clearly labeled after
// the calendar-interval text.
function dueReasonSuffix(dueOverride: EffectiveDue | undefined): string {
  if (!dueOverride || dueOverride.mileageDueAt == null) return "";
  const at = `~${dueOverride.mileageDueAt.toLocaleString()} mi`;
  if (dueOverride.reason === "mileage") return ` · due by mileage (${at})`;
  if (dueOverride.reason === "both") return ` · due by time & mileage (${at})`;
  return ` · not due by mileage until ${at}`;
}

export function MaintenanceRow({
  schedule,
  assetName,
  assetHref,
  vehicle,
  dueOverride,
  doneAction,
  deleteAction,
  dimmed,
}: {
  schedule: MaintenanceSchedule;
  assetName?: string;
  assetHref?: string;
  vehicle?: boolean;
  dueOverride?: EffectiveDue;
  doneAction: (formData: FormData) => Promise<void>;
  deleteAction?: () => Promise<void>;
  dimmed?: boolean;
}) {
  const due = dueInfo(dueOverride?.dueOn ?? schedule.next_due_on);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-4 py-3 transition-opacity",
        dimmed && "opacity-50"
      )}
    >
      <Wrench className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{schedule.name}</p>
        <p className="text-xs text-muted-foreground">
          {assetName && assetHref ? (
            <>
              <Link href={assetHref} className="underline-offset-2 hover:underline">
                {assetName}
              </Link>{" "}
              ·{" "}
            </>
          ) : null}
          <span className={cn("font-medium", toneClasses[due.tone])}>{due.label}</span>
          <span className="capitalize"> · {describeInterval(schedule.interval_value, schedule.interval_unit)}</span>
          {schedule.estimated_cost_cents != null
            ? ` · ~${formatCents(schedule.estimated_cost_cents)}`
            : ""}
          {dueReasonSuffix(dueOverride)}
        </p>
      </div>
      <form action={doneAction} className="flex items-center gap-2">
        {vehicle && (
          <Input
            name="mileage"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Odometer"
            className="h-9 w-24 text-sm"
          />
        )}
        <SubmitButton variant="outline" size="sm" className="h-9 px-3">
          <Check className="size-4" /> Done
        </SubmitButton>
      </form>
      {deleteAction && (
        <form action={deleteAction}>
          <SubmitButton
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-muted-foreground"
          >
            <Trash2 className="size-4" />
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
