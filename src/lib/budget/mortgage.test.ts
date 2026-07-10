import { describe, expect, it } from "vitest";
import {
  computeScenario,
  downPaymentPct,
  monthlyPmi,
  monthlyPrincipalInterest,
  SCENARIO_DEFAULTS,
} from "./mortgage";

describe("downPaymentPct", () => {
  it("computes the percentage of price paid down", () => {
    expect(downPaymentPct(40000000, 4000000)).toBe(10);
    expect(downPaymentPct(50000000, 10000000)).toBe(20);
  });

  it("returns 0 when price is zero or negative (no divide-by-zero)", () => {
    expect(downPaymentPct(0, 0)).toBe(0);
    expect(downPaymentPct(-100, 50)).toBe(0);
  });
});

describe("monthlyPrincipalInterest", () => {
  it("matches a hand-computed standard amortization (30yr, 6.5%, $400k loan)", () => {
    // r = 6.5/100/12; factor = (1+r)^360; PI = loan*r*factor/(factor-1)
    expect(monthlyPrincipalInterest(40000000, 6.5, 360)).toBe(252827);
  });

  it("matches a hand-computed 15-year term at a different rate", () => {
    // loan $250,000, 4.25% APR, 180 months -> $1,880.70/mo (188070 cents)
    expect(monthlyPrincipalInterest(25000000, 4.25, 180)).toBe(188070);
  });

  it("handles the zero-rate edge as straight division, never NaN/Infinity", () => {
    // $360,000 over 360 months at 0% -> exactly $1,000/mo, no compounding.
    expect(monthlyPrincipalInterest(36000000, 0, 360)).toBe(100000);
  });

  it("rounds a zero-rate loan that doesn't divide evenly", () => {
    // $100,000 over 360 months at 0% -> 277.777... -> rounds to 278.
    expect(monthlyPrincipalInterest(10000000, 0, 360)).toBe(27778);
  });

  it("returns 0 for a non-positive loan or term (guards divide-by-zero)", () => {
    expect(monthlyPrincipalInterest(0, 6.5, 360)).toBe(0);
    expect(monthlyPrincipalInterest(-1000, 6.5, 360)).toBe(0);
    expect(monthlyPrincipalInterest(40000000, 6.5, 0)).toBe(0);
  });
});

describe("monthlyPmi", () => {
  it("applies PMI below 20% down, proportional to the loan and annual rate", () => {
    // $400k price, $40k down (10%), $360k loan, 0.75%/yr -> $225.00/mo
    expect(monthlyPmi(36000000, 40000000, 4000000, 0.75)).toBe(22500);
  });

  it("does not apply PMI at exactly 20% down (boundary is inclusive of 20%)", () => {
    expect(monthlyPmi(32000000, 40000000, 8000000, 0.75)).toBe(0);
  });

  it("does not apply PMI above 20% down", () => {
    expect(monthlyPmi(28000000, 40000000, 12000000, 0.75)).toBe(0);
  });

  it("does not apply PMI just under the 20% boundary only when actually below it", () => {
    // 19% down still triggers PMI.
    const priceCents = 40000000;
    const downCents = Math.round(priceCents * 0.19);
    const loanCents = priceCents - downCents;
    expect(monthlyPmi(loanCents, priceCents, downCents, 0.75)).toBeGreaterThan(0);
  });
});

describe("computeScenario", () => {
  it("computes a full 20%-down scenario with no PMI and equity fully covering cash-to-close", () => {
    const result = computeScenario({
      priceCents: 50000000,
      downCents: 10000000, // 20% down
      annualRatePct: 6.5,
      termYears: 30,
      taxRatePct: 1.1,
      insuranceAnnualCents: 180000,
      utilitiesMonthlyCents: 30000,
      hoaMonthlyCents: 0,
      maintenanceReservePct: 1.0,
      pmiAnnualPct: 0.75,
      closingCostPct: 3.0,
      equityFromSaleCents: 30000000, // equity from selling the current home
    });

    expect(result.loanCents).toBe(40000000);
    expect(result.downPaymentPct).toBe(20);
    expect(result.pmiApplies).toBe(false);
    expect(result.pmiCents).toBe(0);
    expect(result.piCents).toBe(252827);
    expect(result.taxCents).toBe(45833);
    expect(result.insuranceCents).toBe(15000);
    expect(result.reserveCents).toBe(41667);
    expect(result.pitiCents).toBe(313660);
    expect(result.totalMonthlyCents).toBe(385327);
    expect(result.closingCostCents).toBe(1500000);
    // down (10,000,000) + closing (1,500,000) - equity (30,000,000) is
    // negative -> clamped to 0, the sale fully covers cash-to-close.
    expect(result.cashToCloseCents).toBe(0);
  });

  it("computes a 10%-down scenario where PMI applies and equity only partially offsets cash needed", () => {
    const result = computeScenario({
      priceCents: 40000000,
      downCents: 4000000, // 10% down
      annualRatePct: 6.5,
      termYears: 30,
      taxRatePct: 1.1,
      insuranceAnnualCents: 180000,
      utilitiesMonthlyCents: 30000,
      hoaMonthlyCents: 0,
      maintenanceReservePct: 1.0,
      pmiAnnualPct: 0.75,
      closingCostPct: 3.0,
      equityFromSaleCents: 0,
    });

    expect(result.loanCents).toBe(36000000);
    expect(result.downPaymentPct).toBe(10);
    expect(result.pmiApplies).toBe(true);
    expect(result.pmiCents).toBe(22500);
    expect(result.piCents).toBe(227544);
    expect(result.taxCents).toBe(36667);
    expect(result.reserveCents).toBe(33333);
    expect(result.pitiCents).toBe(279211);
    expect(result.totalMonthlyCents).toBe(365044);
    expect(result.closingCostCents).toBe(1200000);
    expect(result.cashToCloseCents).toBe(5200000);
  });

  it("never lets cash-to-close go negative even when equity covers more than down + closing", () => {
    const result = computeScenario({
      ...baseInputs(),
      downCents: 1000000,
      equityFromSaleCents: 999999999,
    });
    expect(result.cashToCloseCents).toBe(0);
  });

  it("applies HOA and utilities as flat pass-throughs into the monthly total", () => {
    const withHoa = computeScenario({ ...baseInputs(), hoaMonthlyCents: 45000 });
    const withoutHoa = computeScenario({ ...baseInputs(), hoaMonthlyCents: 0 });
    expect(withHoa.totalMonthlyCents - withoutHoa.totalMonthlyCents).toBe(45000);
    expect(withHoa.hoaCents).toBe(45000);
  });

  it("zero-rate scenario still produces a sane PITI with no PMI at 20%+ down", () => {
    const result = computeScenario({
      priceCents: 30000000,
      downCents: 6000000, // 20%
      annualRatePct: 0,
      termYears: 30,
      taxRatePct: 1.0,
      insuranceAnnualCents: 120000,
      utilitiesMonthlyCents: 0,
      hoaMonthlyCents: 0,
      maintenanceReservePct: 0,
      pmiAnnualPct: 0.75,
      closingCostPct: 2.0,
      equityFromSaleCents: 0,
    });
    // loan 24,000,000 / 360 = 66,666.67 -> 66667
    expect(result.piCents).toBe(66667);
    expect(result.pmiApplies).toBe(false);
  });
});

function baseInputs() {
  return {
    priceCents: SCENARIO_DEFAULTS.priceCents,
    downCents: 10000000,
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
  };
}
