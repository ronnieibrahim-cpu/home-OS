// Deterministic home-purchase math for the Budget & Forecast "Home purchase"
// scenario. Pure functions, no external APIs, no network (see docs/decisions.md
// ADR-011). All money is integer cents; rates are percentages (6.5 = 6.5%/yr).
//
// Property-tax rate and insurance are LOCATION-SENSITIVE placeholders — the app
// flags them in the UI so the household replaces them with their county's real
// millage rate and an actual insurance quote.

export type ScenarioInputs = {
  priceCents: number;
  downCents: number;
  annualRatePct: number;
  termYears: number;
  taxRatePct: number; // annual property tax as % of price
  insuranceAnnualCents: number;
  utilitiesMonthlyCents: number;
  hoaMonthlyCents: number;
  maintenanceReservePct: number; // annual % of home price set aside for upkeep
  pmiAnnualPct: number; // annual PMI as % of loan, charged while down payment < 20%
  closingCostPct: number; // % of price, for the cash-to-close estimate
  equityFromSaleCents: number; // proceeds from selling the current home, applied to cash needed
};

// Sensible, all-editable starting points. Tax rate and insurance are national
// ballparks and flagged as placeholders in the UI.
export const SCENARIO_DEFAULTS = {
  annualRatePct: 6.5,
  termYears: 30,
  taxRatePct: 1.1, // ~U.S. average effective property-tax rate — replace with your county's
  insuranceAnnualCents: 180000, // ~$1,800/yr placeholder — replace with a real quote
  utilitiesMonthlyCents: 30000, // ~$300/mo
  hoaMonthlyCents: 0,
  maintenanceReservePct: 1.0, // the common "1% of home value per year" upkeep rule of thumb
  pmiAnnualPct: 0.75, // typical 0.5–1% of the loan while under 20% down
  closingCostPct: 3.0, // typical 2–4% of price
  downPaymentPct: 20, // used to seed the default down payment from a price
  priceCents: 50000000, // $500,000 fallback when no home value is known
  equityFromSaleCents: 0,
} as const;

export function downPaymentPct(priceCents: number, downCents: number): number {
  if (priceCents <= 0) return 0;
  return (downCents / priceCents) * 100;
}

// Standard fully-amortizing monthly principal + interest. Handles the 0% edge
// (straight division) so the formula never divides by zero.
export function monthlyPrincipalInterest(
  loanCents: number,
  annualRatePct: number,
  termMonths: number
): number {
  if (loanCents <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.round(loanCents / termMonths);
  const factor = Math.pow(1 + r, termMonths);
  return Math.round((loanCents * r * factor) / (factor - 1));
}

// PMI applies only while the down payment is below 20% of price.
export function monthlyPmi(
  loanCents: number,
  priceCents: number,
  downCents: number,
  pmiAnnualPct: number
): number {
  if (downPaymentPct(priceCents, downCents) >= 20) return 0;
  return Math.round((loanCents * (pmiAnnualPct / 100)) / 12);
}

export type ScenarioResult = {
  loanCents: number;
  downPaymentPct: number;
  pmiApplies: boolean;
  // Monthly lines
  piCents: number;
  taxCents: number;
  insuranceCents: number;
  pmiCents: number;
  pitiCents: number; // principal + interest + taxes + insurance (PMI shown separately)
  hoaCents: number;
  utilitiesCents: number;
  reserveCents: number;
  totalMonthlyCents: number; // full monthly cost of ownership
  // One-time cash
  closingCostCents: number;
  cashToCloseCents: number; // down + closing − equity from a current-home sale
};

// The single entry point the UI calls on every slider move — everything is
// derived from the inputs with no side effects, so it's cheap to recompute.
export function computeScenario(inputs: ScenarioInputs): ScenarioResult {
  const loanCents = Math.max(0, inputs.priceCents - inputs.downCents);
  const termMonths = Math.round(inputs.termYears * 12);

  const piCents = monthlyPrincipalInterest(loanCents, inputs.annualRatePct, termMonths);
  const taxCents = Math.round((inputs.priceCents * (inputs.taxRatePct / 100)) / 12);
  const insuranceCents = Math.round(inputs.insuranceAnnualCents / 12);
  const pmiCents = monthlyPmi(loanCents, inputs.priceCents, inputs.downCents, inputs.pmiAnnualPct);
  const reserveCents = Math.round(
    (inputs.priceCents * (inputs.maintenanceReservePct / 100)) / 12
  );

  const pitiCents = piCents + taxCents + insuranceCents;
  const totalMonthlyCents =
    pitiCents + pmiCents + inputs.hoaMonthlyCents + inputs.utilitiesMonthlyCents + reserveCents;

  const closingCostCents = Math.round(inputs.priceCents * (inputs.closingCostPct / 100));
  const cashToCloseCents = Math.max(
    0,
    inputs.downCents + closingCostCents - inputs.equityFromSaleCents
  );

  return {
    loanCents,
    downPaymentPct: downPaymentPct(inputs.priceCents, inputs.downCents),
    pmiApplies: pmiCents > 0,
    piCents,
    taxCents,
    insuranceCents,
    pmiCents,
    pitiCents,
    hoaCents: inputs.hoaMonthlyCents,
    utilitiesCents: inputs.utilitiesMonthlyCents,
    reserveCents,
    totalMonthlyCents,
    closingCostCents,
    cashToCloseCents,
  };
}
