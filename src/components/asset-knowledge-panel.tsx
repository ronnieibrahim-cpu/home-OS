"use client";

import { useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { formatCents, formatDate } from "@/lib/format";
import { describeInterval, todayISO } from "@/lib/schedule";
import { acceptMaintenanceSuggestion } from "@/lib/actions/maintenance";
import { dismissMaintenanceSuggestion, updateAssetKnowledgeDetails } from "@/lib/actions/assets";
import type {
  CurrentValueEstimate,
  ReplacementEstimate,
  SuggestedSchedule,
  Subtype,
} from "@/lib/knowledge/pack";

// Display data for a vehicle's powertrain, prepared on the server so this
// client component doesn't pull in the knowledge pack's JSON.
export type VehicleDisplay = {
  powertrain: string;
  label: string;
  makeLabel: string | null;
  overridden: boolean;
  note: string | null;
};

// Display data for the one-tap mileage tracker (ADR-014), also prepared
// server-side.
export type VehicleMileageDisplay = {
  currentMileage: number | null;
  asOfDate: string | null;
  milesPerYear: number | null;
  milesPerYearMethod: "readings" | "since_purchase" | "national_average" | null;
};

// Shown on the asset detail page: knowledge-pack maintenance suggestions
// (one-tap accept/dismiss) and an estimated replacement year/cost, both
// clearly labeled as editable estimates — see docs/decisions.md ADR-010.
export function AssetKnowledgePanel({
  assetId,
  subtype,
  subtypeOptions,
  vehicle,
  powertrainOptions,
  suggestions: initialSuggestions,
  dismissedKeys,
  replacement,
  currentValue,
  vehicleMileage,
}: {
  assetId: string;
  subtype: Subtype | null;
  subtypeOptions: Subtype[];
  vehicle: VehicleDisplay | null;
  powertrainOptions: { id: string; label: string }[];
  suggestions: SuggestedSchedule[];
  dismissedKeys: string[];
  replacement: ReplacementEstimate | null;
  currentValue: CurrentValueEstimate | null;
  vehicleMileage?: VehicleMileageDisplay | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [suggestions, applyOptimistic] = useOptimistic(
    initialSuggestions,
    (state: SuggestedSchedule[], key: string) => state.filter((s) => s.key !== key)
  );

  if (!subtype && subtypeOptions.length === 0) return null;

  async function handleAccept(s: SuggestedSchedule) {
    applyOptimistic(s.key);
    const res = await acceptMaintenanceSuggestion(assetId, s);
    if (res?.error) setError(res.error);
  }

  async function handleDismiss(s: SuggestedSchedule) {
    applyOptimistic(s.key);
    const res = await dismissMaintenanceSuggestion(assetId, s.key, dismissedKeys);
    if (res?.error) setError(res.error);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <SubtypePicker
        assetId={assetId}
        subtype={subtype}
        options={subtypeOptions}
        onChanged={() => router.refresh()}
      />

      {vehicle && (
        <PowertrainPicker
          assetId={assetId}
          vehicle={vehicle}
          options={powertrainOptions}
          onChanged={() => router.refresh()}
        />
      )}

      {vehicle && vehicleMileage && (
        <VehicleMileageCard
          assetId={assetId}
          mileage={vehicleMileage}
          onChanged={() => router.refresh()}
        />
      )}

      {subtype && suggestions.length > 0 && (
        <div className="rounded-md border p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="size-4 text-primary" /> Suggested maintenance
          </p>
          <div className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <div key={s.key} className="flex items-center gap-3 rounded-md border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {describeInterval(s.intervalValue, s.intervalUnit)}
                    {s.estimatedCostHighCents > 0
                      ? ` · ~${formatCents(s.estimatedCostLowCents)}–${formatCents(s.estimatedCostHighCents)}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-3"
                  onClick={() => handleAccept(s)}
                >
                  <Check className="size-4" /> Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-muted-foreground"
                  onClick={() => handleDismiss(s)}
                  aria-label="Dismiss suggestion"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {replacement && <ReplacementCard assetId={assetId} replacement={replacement} currentValue={currentValue} />}
    </div>
  );
}

function SubtypePicker({
  assetId,
  subtype,
  options,
  onChanged,
}: {
  assetId: string;
  subtype: Subtype | null;
  options: Subtype[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(value: string) {
    setSaving(true);
    await updateAssetKnowledgeDetails(assetId, {
      subtype: value === "none" ? "none" : (value as Subtype["id"]),
    });
    setSaving(false);
    setEditing(false);
    onChanged();
  }

  if (!editing) {
    return (
      <p className="text-xs text-muted-foreground">
        {subtype ? (
          <>Suggestions based on: <span className="font-medium">{subtype.label}</span>.</>
        ) : (
          "No maintenance kind detected for this asset."
        )}{" "}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="underline-offset-2 hover:underline"
        >
          {subtype ? "Not right?" : "Pick one"}
        </button>
      </p>
    );
  }

  const selectClass =
    "h-10 w-full appearance-none rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={subtype?.id ?? "none"}
        disabled={saving}
        onChange={(e) => save(e.target.value)}
        className={selectClass}
      >
        <option value="none">None of these / not applicable</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}

// Vehicles only: shows the guessed (or confirmed) powertrain and lets the
// household correct it. Changing it re-derives the maintenance suggestions and
// depreciation curve on the server (an EV drops the oil change).
function PowertrainPicker({
  assetId,
  vehicle,
  options,
  onChanged,
}: {
  assetId: string;
  vehicle: VehicleDisplay;
  options: { id: string; label: string }[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(value: string) {
    setSaving(true);
    await updateAssetKnowledgeDetails(assetId, { powertrain: value as never });
    setSaving(false);
    setEditing(false);
    onChanged();
  }

  const selectClass =
    "h-10 w-full appearance-none rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";

  if (!editing) {
    return (
      <p className="text-xs text-muted-foreground">
        Powertrain: <span className="font-medium">{vehicle.label}</span>
        {vehicle.makeLabel ? ` (${vehicle.makeLabel})` : ""}
        {vehicle.note ? ` — ${vehicle.note}` : ""}
        {vehicle.overridden ? "" : " (guessed)"}{" "}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="underline-offset-2 hover:underline"
        >
          Not right?
        </button>
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={vehicle.powertrain}
        disabled={saving}
        onChange={(e) => save(e.target.value)}
        className={selectClass}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}

const milesPerYearMethodLabel: Record<
  NonNullable<VehicleMileageDisplay["milesPerYearMethod"]>,
  string
> = {
  readings: "from your mileage history",
  since_purchase: "since purchase — logs a second reading to refine this",
  national_average: "national average — no mileage history yet",
};

// One-tap odometer update (ADR-014): shows the latest known mileage + as-of
// date and the estimated miles/year behind mileage-based due dates, editable
// inline like the powertrain/subtype pickers above.
function VehicleMileageCard({
  assetId,
  mileage,
  onChanged,
}: {
  assetId: string;
  mileage: VehicleMileageDisplay;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(formData: FormData) {
    const raw = String(formData.get("mileage") ?? "").trim();
    const value = parseInt(raw, 10);
    if (!raw || !Number.isFinite(value) || value < 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await updateAssetKnowledgeDetails(assetId, {
      current_mileage: value,
      current_mileage_asof: todayISO(),
    });
    setSaving(false);
    setEditing(false);
    onChanged();
  }

  return (
    <div className="rounded-md border p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium">Mileage</p>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <Pencil className="size-3" /> Update mileage
          </button>
        )}
      </div>

      {editing ? (
        <form action={save} className="mt-2 flex items-center gap-2">
          <Input
            name="mileage"
            type="number"
            inputMode="numeric"
            min={0}
            autoFocus
            defaultValue={mileage.currentMileage ?? undefined}
            placeholder="Odometer (mi)"
            className="h-10 text-sm"
          />
          <SubmitButton size="sm" className="h-9 shrink-0">
            Save
          </SubmitButton>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <p className="text-lg font-semibold tabular-nums">
            {mileage.currentMileage != null ? `${mileage.currentMileage.toLocaleString()} mi` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {mileage.asOfDate ? `As of ${formatDate(mileage.asOfDate)}` : "No reading yet"}
            {mileage.milesPerYear != null && mileage.milesPerYearMethod
              ? ` · ~${Math.round(mileage.milesPerYear).toLocaleString()} mi/year (${milesPerYearMethodLabel[mileage.milesPerYearMethod]})`
              : ""}
          </p>
        </>
      )}
    </div>
  );
}

function ReplacementCard({
  assetId,
  replacement,
  currentValue,
}: {
  assetId: string;
  replacement: ReplacementEstimate;
  currentValue: CurrentValueEstimate | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const displayYear =
    replacement.yearOverride ??
    (replacement.yearLow && replacement.yearHigh
      ? Math.round((replacement.yearLow + replacement.yearHigh) / 2)
      : null);
  const displayCostCents =
    replacement.costOverrideCents ??
    Math.round((replacement.costLowCents + replacement.costHighCents) / 2);
  const isOverridden = replacement.yearOverride != null || replacement.costOverrideCents != null;

  async function save(formData: FormData) {
    setSaving(true);
    const yearRaw = String(formData.get("year") ?? "").trim();
    const costRaw = String(formData.get("cost") ?? "").replace(/[$,\s]/g, "");
    await updateAssetKnowledgeDetails(assetId, {
      replacement_year_override: yearRaw ? parseInt(yearRaw, 10) : undefined,
      replacement_cost_cents_override: costRaw ? Math.round(Number(costRaw) * 100) : undefined,
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function reset() {
    setSaving(true);
    await updateAssetKnowledgeDetails(assetId, {
      replacement_year_override: undefined,
      replacement_cost_cents_override: undefined,
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="rounded-md border p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium">Estimated replacement</p>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <Pencil className="size-3" /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <form action={save} className="mt-2 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Replacement year
              <Input
                name="year"
                type="number"
                defaultValue={displayYear ?? undefined}
                className="h-10 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Est. cost ($)
              <Input
                name="cost"
                inputMode="decimal"
                defaultValue={(displayCostCents / 100).toFixed(0)}
                className="h-10 text-sm"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <SubmitButton size="sm" className="h-9">
              Save
            </SubmitButton>
            {isOverridden && (
              <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={reset}>
                Reset to default estimate
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-lg font-semibold tabular-nums">
            {displayYear ?? "—"}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              ~{formatCents(displayCostCents)}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isOverridden
              ? "Your estimate."
              : replacement.yearLow && replacement.yearHigh
                ? `Estimate: typical ${replacement.subtype.label.toLowerCase()} lasts ${replacement.lifespanYearsLow}–${replacement.lifespanYearsHigh} years. Range ${formatCents(replacement.costLowCents)}–${formatCents(replacement.costHighCents)}.`
                : `Estimate only — add a purchase date for a year. Typical cost ${formatCents(replacement.costLowCents)}–${formatCents(replacement.costHighCents)}.`}
          </p>
          {currentValue && (
            <p className="mt-1 text-xs text-muted-foreground">
              Estimated current value: ~{formatCents(currentValue.valueCents)} (typical depreciation for this kind of asset)
            </p>
          )}
        </>
      )}
    </div>
  );
}
