import { describe, expect, it } from "vitest";
import { vehicleProfile } from "./pack";
import type { Asset } from "@/lib/types";

// detectPowertrain() itself is a private helper; it's exercised here through
// vehicleProfile(), the public function that wraps it and applies the
// household override — the same path the app calls (see ADR-012).
type VehicleInput = Pick<Asset, "name" | "category" | "details"> &
  Partial<Pick<Asset, "manufacturer" | "model_number">>;

function vehicle(overrides: Partial<VehicleInput>): VehicleInput {
  return {
    name: "",
    category: "vehicle",
    manufacturer: null,
    model_number: null,
    details: null,
    ...overrides,
  };
}

describe("vehicleProfile / detectPowertrain", () => {
  it("Tesla is electric regardless of model, via the make's defaultPowertrain", () => {
    const profile = vehicleProfile(
      vehicle({ name: "Tesla Model 3", manufacturer: "Tesla", model_number: "Model 3" })
    );
    expect(profile?.powertrain).toBe("electric");
    expect(profile?.powertrainOverridden).toBe(false);
    expect(profile?.make?.id).toBe("tesla");
    expect(profile?.segmentTier).toBe("luxury");
  });

  it("Toyota Prius is hybrid, via the make's hybridKeywords", () => {
    const profile = vehicleProfile(
      vehicle({ name: "Toyota Prius", manufacturer: "Toyota", model_number: "Prius" })
    );
    expect(profile?.powertrain).toBe("hybrid");
    expect(profile?.make?.id).toBe("toyota");
  });

  it("Chevrolet Volt is a plug-in hybrid, via the make's phevKeywords", () => {
    const profile = vehicleProfile(
      vehicle({ name: "Chevrolet Volt", manufacturer: "Chevrolet", model_number: "Volt" })
    );
    expect(profile?.powertrain).toBe("phev");
    expect(profile?.make?.id).toBe("chevrolet");
  });

  it("Honda Odyssey is gas, the make's default when no ev/phev/hybrid keyword matches", () => {
    const profile = vehicleProfile(
      vehicle({ name: "Honda Odyssey", manufacturer: "Honda", model_number: "Odyssey" })
    );
    expect(profile?.powertrain).toBe("gas");
    expect(profile?.make?.id).toBe("honda");
  });

  it("a household override in details.powertrain wins over the guessed value", () => {
    const profile = vehicleProfile(
      vehicle({
        name: "Tesla Model 3",
        manufacturer: "Tesla",
        model_number: "Model 3",
        details: { powertrain: "gas" },
      })
    );
    expect(profile?.powertrain).toBe("gas");
    expect(profile?.powertrainOverridden).toBe(true);
    // The make/tier guess is unaffected by the powertrain override.
    expect(profile?.make?.id).toBe("tesla");
    expect(profile?.segmentTier).toBe("luxury");
  });

  it("an invalid override value is ignored and falls back to the guess", () => {
    const profile = vehicleProfile(
      vehicle({
        name: "Honda Odyssey",
        manufacturer: "Honda",
        details: { powertrain: "hydrogen" },
      })
    );
    expect(profile?.powertrain).toBe("gas");
    expect(profile?.powertrainOverridden).toBe(false);
  });

  it("falls back to generic keyword detection and a gas/mainstream default for an unrecognized make", () => {
    const hybridFallback = vehicleProfile(vehicle({ name: "Acme Hybrid Cruiser", manufacturer: "Acme" }));
    expect(hybridFallback?.powertrain).toBe("hybrid");
    expect(hybridFallback?.make).toBeNull();
    expect(hybridFallback?.segmentTier).toBe("mainstream");

    const gasFallback = vehicleProfile(vehicle({ name: "Acme Roadster", manufacturer: "Acme" }));
    expect(gasFallback?.powertrain).toBe("gas");
    expect(gasFallback?.make).toBeNull();
  });

  it("returns null for a non-vehicle asset", () => {
    expect(vehicleProfile(vehicle({ category: "appliance", name: "Tesla-branded toaster" }))).toBeNull();
  });
});
