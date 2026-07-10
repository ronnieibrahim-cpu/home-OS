"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/format";
import type { CurrentBudget } from "@/lib/budget/current-budget";
import type { Forecast } from "@/lib/budget/forecast";
import {
  computeScenario,
  downPaymentPct,
  SCENARIO_DEFAULTS,
  type ScenarioInputs,
} from "@/lib/budget/mortgage";

// Validated 3-series categorical palette (dataviz skill): blue / aqua / orange,
// with dark-mode steps. Legend is always shown (relief for the aqua contrast).
const SERIES = {
  recurring: { label: "Recurring", fill: "fill-[#2a78d6] dark:fill-[#3987e5]", swatch: "bg-[#2a78d6] dark:bg-[#3987e5]" },
  maintenance: { label: "Maintenance", fill: "fill-[#1baf7a] dark:fill-[#199e70]", swatch: "bg-[#1baf7a] dark:bg-[#199e70]" },
  replacement: { label: "Replacements", fill: "fill-[#eb6834] dark:fill-[#d95926]", swatch: "bg-[#eb6834] dark:bg-[#d95926]" },
} as const;

type View = "current" | "forecast" | "purchase";

// Full scenario state = the mortgage inputs plus how much current housing cost
// the purchase replaces (0 = additive / keeping the current home).
type Scenario = ScenarioInputs & { replaceCents: number };

export function BudgetView({
  currentBudget,
  forecast,
  seedPriceCents,
}: {
  currentBudget: CurrentBudget;
  forecast: Forecast;
  seedPriceCents: number;
}) {
  const [view, setView] = useState<View>("current");

  return (
    <div>
      <SegmentedControl
        value={view}
        onChange={setView}
        options={[
          { id: "current", label: "This month" },
          { id: "forecast", label: "Forecast" },
          { id: "purchase", label: "Home purchase" },
        ]}
      />

      {view === "current" && <CurrentBudgetPanel budget={currentBudget} />}
      {view === "forecast" && <ForecastPanel forecast={forecast} />}
      {view === "purchase" && (
        <PurchaseScenarioPanel
          seedPriceCents={seedPriceCents}
          currentTotalCents={currentBudget.totalCents}
          housingCommittedCents={currentBudget.housingCommittedCents}
        />
      )}
    </div>
  );
}

// --- Segmented control (instant, no navigation) -----------------------------

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: View;
  onChange: (v: View) => void;
  options: { id: View; label: string }[];
}) {
  return (
    <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors active:opacity-70",
            value === o.id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// --- View 1: current monthly budget -----------------------------------------

function CurrentBudgetPanel({ budget }: { budget: CurrentBudget }) {
  return (
    <div>
      <div className="mb-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">Projected monthly budget</p>
        <p className="text-3xl font-semibold tabular-nums">
          {formatCents(budget.totalCents)}
          <span className="text-base font-normal text-muted-foreground">/mo</span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Committed {formatCents(budget.committedTotalCents)} · maintenance reserve{" "}
          {formatCents(budget.reserveTotalCents)} · variable extras{" "}
          {formatCents(budget.extrasTotalCents)}
        </p>
      </div>

      {budget.lines.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Nothing to budget yet. Add recurring commitments, maintenance schedules, or expenses.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {budget.lines.map((line) => (
            <div key={line.category} className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium capitalize">{line.category}</span>
                <span className="tabular-nums font-medium">{formatCents(line.totalCents)}/mo</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[
                  line.committedCents > 0 ? `committed ${formatCents(line.committedCents)}` : null,
                  line.reserveCents > 0 ? `reserve ${formatCents(line.reserveCents)}` : null,
                  line.extrasCents > 0 ? `extras ${formatCents(line.extrasCents)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        &ldquo;Extras&rdquo; is your average monthly spending over the last {budget.actualsMonths}{" "}
        months that isn&rsquo;t tied to a commitment and isn&rsquo;t maintenance — so nothing is
        counted twice.
      </p>
    </div>
  );
}

// --- View 2: 24-month forecast ----------------------------------------------

function ForecastPanel({ forecast }: { forecast: Forecast }) {
  const [selected, setSelected] = useState<number | null>(null);
  const months = forecast.months;
  const maxTotal = Math.max(1, ...months.map((m) => m.totalCents));

  // Chart geometry (horizontally scrollable on a phone).
  const step = 28;
  const barW = 22;
  const plotH = 150;
  const labelH = 22;
  const width = months.length * step;
  const height = plotH + labelH;

  const active = selected !== null ? months[selected] : null;

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Stat label="Next 24 months" value={formatCents(forecast.totalCents)} />
        <Stat label="Average / month" value={formatCents(forecast.averageMonthlyCents)} />
      </div>

      <Legend />

      <div className="mb-4 overflow-x-auto rounded-md border py-3 [-webkit-overflow-scrolling:touch]">
        <svg width={width} height={height} role="img" aria-label="Projected monthly spending" className="block">
          {months.map((m, i) => {
            const x = i * step + (step - barW) / 2;
            const segs = [
              { key: "recurring" as const, value: m.recurringCents },
              { key: "maintenance" as const, value: m.maintenanceCents },
              { key: "replacement" as const, value: m.replacementCents },
            ].filter((s) => s.value > 0);
            let cursorY = plotH;
            const topKey = segs.length ? segs[segs.length - 1].key : null;
            return (
              <g key={m.monthISO} onClick={() => setSelected(i)} className="cursor-pointer">
                {/* Tap target across the full column */}
                <rect x={i * step} y={0} width={step} height={plotH} fill="transparent" />
                {segs.map((s) => {
                  const h = Math.max(2, (s.value / maxTotal) * plotH);
                  cursorY -= h;
                  const isTop = s.key === topKey;
                  return (
                    <rect
                      key={s.key}
                      x={x}
                      y={cursorY}
                      width={barW}
                      height={isTop ? h : Math.max(1, h - 2)} // 2px surface gap between fills
                      rx={isTop ? 4 : 0}
                      className={cn(
                        SERIES[s.key].fill,
                        selected !== null && selected !== i && "opacity-40"
                      )}
                    />
                  );
                })}
                {i % 3 === 0 && (
                  <text
                    x={i * step + step / 2}
                    y={plotH + 14}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px]"
                  >
                    {m.label.replace(" ", " ")}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {active && (
        <div className="mb-4 rounded-md border px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">{active.label}</p>
            <p className="tabular-nums font-medium">{formatCents(active.totalCents)}</p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Recurring {formatCents(active.recurringCents)} · maintenance{" "}
            {formatCents(active.maintenanceCents)} · replacements{" "}
            {formatCents(active.replacementCents)}
          </p>
          {active.events.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {active.events.slice(0, 6).map((e, idx) => (
                <li key={idx} className="flex justify-between gap-2">
                  <span className="truncate">{e.label}</span>
                  <span className="tabular-nums">{formatCents(e.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {forecast.bigHits.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Big upcoming hits</h3>
          <div className="flex flex-col gap-2">
            {forecast.bigHits.map((e, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-md border px-4 py-2.5">
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    e.kind === "replacement" ? SERIES.replacement.swatch : SERIES.maintenance.swatch
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.label}</p>
                  <p className="text-xs text-muted-foreground">{e.monthLabel}</p>
                </div>
                <span className="tabular-nums text-sm font-medium">{formatCents(e.amountCents)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Recurring commitments are smoothed to their monthly-equivalent; maintenance and predicted
        replacements land in the month they come due. Replacement years come from the knowledge
        pack&rsquo;s typical lifespans and are editable on each asset.
      </p>
    </div>
  );
}

function Legend() {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", SERIES[k].swatch)} />
          {SERIES[k].label}
        </span>
      ))}
    </div>
  );
}

// --- View 3: home-purchase scenario -----------------------------------------

function defaultScenario(seedPriceCents: number, housingCommittedCents: number): Scenario {
  return {
    priceCents: seedPriceCents,
    downCents: Math.round(seedPriceCents * (SCENARIO_DEFAULTS.downPaymentPct / 100)),
    annualRatePct: SCENARIO_DEFAULTS.annualRatePct,
    termYears: SCENARIO_DEFAULTS.termYears,
    taxRatePct: SCENARIO_DEFAULTS.taxRatePct,
    insuranceAnnualCents: SCENARIO_DEFAULTS.insuranceAnnualCents,
    utilitiesMonthlyCents: SCENARIO_DEFAULTS.utilitiesMonthlyCents,
    hoaMonthlyCents: SCENARIO_DEFAULTS.hoaMonthlyCents,
    maintenanceReservePct: SCENARIO_DEFAULTS.maintenanceReservePct,
    pmiAnnualPct: SCENARIO_DEFAULTS.pmiAnnualPct,
    closingCostPct: SCENARIO_DEFAULTS.closingCostPct,
    equityFromSaleCents: SCENARIO_DEFAULTS.equityFromSaleCents,
    replaceCents: housingCommittedCents,
  };
}

// Compact URL keys so a specific price/rate combo is bookmarkable & reload-safe.
const URL_KEYS: Record<keyof Scenario, string> = {
  priceCents: "p",
  downCents: "d",
  annualRatePct: "r",
  termYears: "t",
  taxRatePct: "tx",
  insuranceAnnualCents: "ins",
  utilitiesMonthlyCents: "u",
  hoaMonthlyCents: "h",
  maintenanceReservePct: "rz",
  pmiAnnualPct: "pmi",
  closingCostPct: "cc",
  equityFromSaleCents: "eq",
  replaceCents: "rep",
};

function parseScenarioFromSearch(search: string, fallback: Scenario): Scenario {
  const params = new URLSearchParams(search);
  if ([...params.keys()].length === 0) return fallback;
  const next = { ...fallback };
  for (const key of Object.keys(URL_KEYS) as (keyof Scenario)[]) {
    const raw = params.get(URL_KEYS[key]);
    if (raw !== null && raw !== "") {
      const num = Number(raw);
      if (Number.isFinite(num) && num >= 0) next[key] = num;
    }
  }
  return next;
}

function scenarioToQuery(s: Scenario): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(URL_KEYS) as (keyof Scenario)[]) {
    params.set(URL_KEYS[key], String(Math.round(s[key] * 1000) / 1000));
  }
  return params.toString();
}

function PurchaseScenarioPanel({
  seedPriceCents,
  currentTotalCents,
  housingCommittedCents,
}: {
  seedPriceCents: number;
  currentTotalCents: number;
  housingCommittedCents: number;
}) {
  const fallback = useMemo(
    () => defaultScenario(seedPriceCents, housingCommittedCents),
    [seedPriceCents, housingCommittedCents]
  );
  const [s, setS] = useState<Scenario>(fallback);

  // Restore a bookmarked/shared scenario from the URL on mount. Reading the URL
  // is a one-time sync from an external system, which is a valid effect use.
  useEffect(() => {
    const parsed = parseScenarioFromSearch(window.location.search, fallback);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setS(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch: Partial<Scenario>) {
    setS((prev) => {
      const next = { ...prev, ...patch };
      const qs = scenarioToQuery(next);
      window.history.replaceState(null, "", qs ? `/budget?${qs}` : "/budget");
      return next;
    });
  }

  const result = useMemo(() => computeScenario(s), [s]);

  const afterTotal = currentTotalCents - s.replaceCents + result.totalMonthlyCents;
  const delta = afterTotal - currentTotalCents;

  return (
    <div className="flex flex-col gap-5">
      {/* Sliders — the two the household most wants to explore */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <SliderRow
          label="Home price"
          value={formatCents(s.priceCents)}
          min={10000000}
          max={200000000}
          step={500000}
          current={s.priceCents}
          onChange={(v) => update({ priceCents: v })}
        />
        <SliderRow
          label="Interest rate"
          value={`${s.annualRatePct.toFixed(2)}%`}
          min={2}
          max={10}
          step={0.05}
          current={s.annualRatePct}
          onChange={(v) => update({ annualRatePct: v })}
        />
      </div>

      {/* Monthly cost of ownership */}
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">Total monthly cost of ownership</p>
        <p className="text-3xl font-semibold tabular-nums">
          {formatCents(result.totalMonthlyCents)}
          <span className="text-base font-normal text-muted-foreground">/mo</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatCents(s.priceCents)} · {result.downPaymentPct.toFixed(0)}% down ·{" "}
          {s.annualRatePct.toFixed(2)}% · {s.termYears}yr
        </p>

        <dl className="mt-4 flex flex-col gap-1.5 text-sm">
          <BreakdownRow label="Principal & interest" cents={result.piCents} />
          <BreakdownRow label="Property tax" cents={result.taxCents} flag />
          <BreakdownRow label="Insurance" cents={result.insuranceCents} flag />
          {result.pmiApplies && (
            <BreakdownRow label="PMI (under 20% down)" cents={result.pmiCents} />
          )}
          <div className="my-1 border-t" />
          <BreakdownRow label="PITI subtotal" cents={result.pitiCents} strong />
          {s.hoaMonthlyCents > 0 && <BreakdownRow label="HOA" cents={result.hoaCents} />}
          <BreakdownRow label="Utilities (est.)" cents={result.utilitiesCents} />
          <BreakdownRow label="Maintenance reserve" cents={result.reserveCents} />
          <div className="my-1 border-t" />
          <BreakdownRow label="Total monthly" cents={result.totalMonthlyCents} strong />
        </dl>
      </div>

      {/* Cash needed at closing */}
      <div className="rounded-md border px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Cash needed at closing</p>
          <p className="tabular-nums font-semibold">{formatCents(result.cashToCloseCents)}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Down payment {formatCents(s.downCents)} + closing costs{" "}
          {formatCents(result.closingCostCents)}
          {s.equityFromSaleCents > 0 ? ` − home-sale equity ${formatCents(s.equityFromSaleCents)}` : ""}
        </p>
      </div>

      {/* Side-by-side: today vs after purchase */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Today vs. after purchase</h3>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Today" value={`${formatCents(currentTotalCents)}/mo`} />
          <Stat label="After purchase" value={`${formatCents(afterTotal)}/mo`} />
        </div>
        <p
          className={cn(
            "mt-2 text-sm font-medium",
            delta > 0 ? "text-destructive" : "text-[#006300] dark:text-[#0ca30c]"
          )}
        >
          {delta >= 0 ? "+" : "−"}
          {formatCents(Math.abs(delta))}/mo vs. today
        </p>
      </div>

      <SensitivityGrid scenario={s} />

      {/* Editable inputs */}
      <details className="rounded-md border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">All inputs &amp; assumptions</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <MoneyInput label="Home price" cents={s.priceCents} onChange={(v) => update({ priceCents: v })} />
          <MoneyInput
            label="Down payment"
            cents={s.downCents}
            onChange={(v) => update({ downCents: v })}
            hint={`${downPaymentPct(s.priceCents, s.downCents).toFixed(0)}%`}
          />
          <NumberInput label="Interest rate %" value={s.annualRatePct} step={0.05} onChange={(v) => update({ annualRatePct: v })} />
          <NumberInput label="Term (years)" value={s.termYears} step={1} onChange={(v) => update({ termYears: v })} />
          <NumberInput label="Property tax %/yr" value={s.taxRatePct} step={0.05} onChange={(v) => update({ taxRatePct: v })} flag />
          <MoneyInput label="Insurance $/yr" cents={s.insuranceAnnualCents} onChange={(v) => update({ insuranceAnnualCents: v })} flag />
          <MoneyInput label="Utilities $/mo" cents={s.utilitiesMonthlyCents} onChange={(v) => update({ utilitiesMonthlyCents: v })} />
          <MoneyInput label="HOA $/mo" cents={s.hoaMonthlyCents} onChange={(v) => update({ hoaMonthlyCents: v })} />
          <NumberInput label="Maint. reserve %/yr" value={s.maintenanceReservePct} step={0.1} onChange={(v) => update({ maintenanceReservePct: v })} />
          <NumberInput label="PMI %/yr of loan" value={s.pmiAnnualPct} step={0.05} onChange={(v) => update({ pmiAnnualPct: v })} />
          <NumberInput label="Closing costs %" value={s.closingCostPct} step={0.5} onChange={(v) => update({ closingCostPct: v })} />
          <MoneyInput label="Equity from home sale" cents={s.equityFromSaleCents} onChange={(v) => update({ equityFromSaleCents: v })} />
          <MoneyInput
            label="Current housing cost this replaces"
            cents={s.replaceCents}
            onChange={(v) => update({ replaceCents: v })}
            hint="0 = keeping current home"
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          ⚑ Property tax and insurance are national-ballpark placeholders — replace them with your
          county&rsquo;s actual rate and a real insurance quote.
        </p>
      </details>
    </div>
  );
}

// Price × rate grid of monthly PITI (+PMI) — the part price and rate actually move.
function SensitivityGrid({ scenario }: { scenario: Scenario }) {
  const priceSteps = [-0.1, -0.05, 0, 0.05, 0.1];
  const rateDeltas = [-1, -0.5, 0, 0.5, 1];

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Monthly PITI by price &amp; rate</h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr className="text-muted-foreground">
              <th className="p-2 text-left font-medium">Price \ Rate</th>
              {rateDeltas.map((rd) => (
                <th key={rd} className="p-2 text-right font-medium">
                  {(scenario.annualRatePct + rd).toFixed(2)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {priceSteps.map((ps) => {
              const price = Math.round(scenario.priceCents * (1 + ps));
              return (
                <tr key={ps} className="border-t">
                  <th className="p-2 text-left font-medium text-muted-foreground">
                    {formatCents(price)}
                  </th>
                  {rateDeltas.map((rd) => {
                    const rate = scenario.annualRatePct + rd;
                    const r = computeScenario({
                      ...scenario,
                      priceCents: price,
                      // Keep the down-payment percentage constant across the grid.
                      downCents: Math.round(price * (scenario.downCents / scenario.priceCents || 0)),
                      annualRatePct: rate,
                    });
                    const isCurrent = ps === 0 && rd === 0;
                    const piti = r.pitiCents + r.pmiCents;
                    return (
                      <td
                        key={rd}
                        className={cn(
                          "p-2 text-right",
                          isCurrent && "bg-primary/10 font-semibold"
                        )}
                      >
                        {formatCents(piti)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Principal, interest, taxes &amp; insurance (plus PMI where under 20% down). Down-payment
        percentage is held constant across the grid.
      </p>
    </div>
  );
}

// --- Small shared pieces ----------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function BreakdownRow({
  label,
  cents,
  strong,
  flag,
}: {
  label: string;
  cents: number;
  strong?: boolean;
  flag?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", strong && "font-semibold")}>
      <dt className="text-muted-foreground">
        {label}
        {flag ? <span className="ml-1 text-muted-foreground/70">⚑</span> : null}
      </dt>
      <dd className="tabular-nums">{formatCents(cents)}</dd>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
      />
    </label>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";

function MoneyInput({
  label,
  cents,
  onChange,
  hint,
  flag,
}: {
  label: string;
  cents: number;
  onChange: (cents: number) => void;
  hint?: string;
  flag?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>
        {label}
        {flag ? " ⚑" : ""}
        {hint ? <span className="ml-1 text-muted-foreground/70">({hint})</span> : null}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={cents === 0 ? "" : cents / 100}
        placeholder="0"
        onChange={(e) => onChange(e.target.value === "" ? 0 : Math.round(Number(e.target.value) * 100))}
        className={inputClass}
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  step,
  onChange,
  flag,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
  flag?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>
        {label}
        {flag ? " ⚑" : ""}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={inputClass}
      />
    </label>
  );
}
