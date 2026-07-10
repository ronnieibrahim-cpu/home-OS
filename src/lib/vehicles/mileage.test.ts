import { describe, expect, it } from "vitest";
import {
  effectiveDueDate,
  estimateMilesPerYear,
  NATIONAL_AVERAGE_MILES_PER_YEAR,
} from "./mileage";

describe("estimateMilesPerYear", () => {
  it("uses the secant slope between the earliest and latest of multiple readings", () => {
    const est = estimateMilesPerYear({
      purchaseDate: "2020-01-01",
      currentMileage: 40_000,
      currentMileageAsOf: "2024-01-01",
      logReadings: [
        { date: "2022-01-01", mileage: 20_000 },
        { date: "2023-01-01", mileage: 30_000 },
      ],
    });
    // Earliest (2022-01-01, 20000) -> latest (2024-01-01, 40000): 20000 mi / 2 yrs.
    expect(est.method).toBe("readings");
    expect(est.pointsUsed).toBe(3);
    expect(est.milesPerYear).toBeCloseTo(10_000, -2);
  });

  it("falls back to slope since purchase date with only one reading", () => {
    const est = estimateMilesPerYear({
      purchaseDate: "2022-01-01",
      currentMileage: 20_000,
      currentMileageAsOf: "2024-01-01",
      logReadings: [],
    });
    expect(est.method).toBe("since_purchase");
    expect(est.milesPerYear).toBeCloseTo(10_000, -2);
  });

  it("falls back to the national average when nothing is known", () => {
    const est = estimateMilesPerYear({
      purchaseDate: null,
      currentMileage: null,
      currentMileageAsOf: null,
      logReadings: [],
    });
    expect(est.method).toBe("national_average");
    expect(est.milesPerYear).toBe(NATIONAL_AVERAGE_MILES_PER_YEAR);
    expect(est.pointsUsed).toBe(0);
  });

  it("falls back to the national average when readings don't span meaningful time", () => {
    const est = estimateMilesPerYear({
      purchaseDate: null,
      currentMileage: 20_000,
      currentMileageAsOf: "2024-01-01",
      logReadings: [{ date: "2024-01-01", mileage: 20_000 }],
    });
    expect(est.method).toBe("national_average");
  });
});

describe("effectiveDueDate", () => {
  it("picks the mileage projection when it lands sooner than the calendar date", () => {
    const due = effectiveDueDate({
      timeDueOn: "2025-06-01",
      intervalMiles: 5_000,
      lastServiceMileage: 30_000,
      currentMileage: 34_000,
      currentMileageAsOf: "2024-01-01",
      milesPerYear: 12_000,
    });
    // Needs 1,000 more miles at 12,000/yr -> ~0.083 yr -> ~2024-02-01, well
    // before the calendar date.
    expect(due.reason).toBe("mileage");
    expect(due.mileageDueAt).toBe(35_000);
    expect(due.dueOn).not.toBeNull();
    expect(due.dueOn! < "2025-06-01").toBe(true);
  });

  it("picks the calendar date when mileage won't be reached for a long time", () => {
    const due = effectiveDueDate({
      timeDueOn: "2024-03-01",
      intervalMiles: 5_000,
      lastServiceMileage: 10_000,
      currentMileage: 11_000,
      currentMileageAsOf: "2024-01-01",
      milesPerYear: 6_000,
    });
    expect(due.reason).toBe("time");
    expect(due.dueOn).toBe("2024-03-01");
  });

  it("falls back to current mileage as the baseline when the schedule was never serviced with a reading", () => {
    const due = effectiveDueDate({
      timeDueOn: null,
      intervalMiles: 5_000,
      lastServiceMileage: null,
      currentMileage: 20_000,
      currentMileageAsOf: "2024-01-01",
      milesPerYear: 10_000,
    });
    expect(due.mileageDueAt).toBe(25_000);
    expect(due.reason).toBe("mileage");
  });

  it("is already overdue by mileage when currentMileage has passed the threshold", () => {
    const due = effectiveDueDate({
      timeDueOn: null,
      intervalMiles: 5_000,
      lastServiceMileage: 10_000,
      currentMileage: 16_000,
      currentMileageAsOf: "2024-06-01",
      milesPerYear: 12_000,
    });
    expect(due.mileageDueAt).toBe(15_000);
    expect(due.dueOn! < "2024-06-01").toBe(true);
  });

  it("returns calendar-only when there's no mileage data", () => {
    const due = effectiveDueDate({
      timeDueOn: "2024-09-01",
      intervalMiles: null,
      lastServiceMileage: null,
      currentMileage: null,
      currentMileageAsOf: null,
      milesPerYear: 12_000,
    });
    expect(due.reason).toBe("time");
    expect(due.mileageDueOn).toBeNull();
    expect(due.dueOn).toBe("2024-09-01");
  });

  it("returns nothing when neither time nor mileage data is available", () => {
    const due = effectiveDueDate({
      timeDueOn: null,
      intervalMiles: null,
      lastServiceMileage: null,
      currentMileage: null,
      currentMileageAsOf: null,
      milesPerYear: 12_000,
    });
    expect(due.dueOn).toBeNull();
    expect(due.reason).toBeNull();
  });
});
