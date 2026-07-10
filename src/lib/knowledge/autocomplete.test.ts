import { describe, expect, it } from "vitest";
import { listManufacturerOptions, suggestFromName } from "./autocomplete";

describe("suggestFromName", () => {
  it("suggests vehicle / SUV / Tesla for 'Tesla Model Y'", () => {
    const s = suggestFromName("Tesla Model Y");
    expect(s?.category).toBe("vehicle");
    expect(s?.subtypeLabel).toMatch(/SUV/i);
    expect(s?.manufacturer).toBe("Tesla");
  });

  it("suggests appliance / dishwasher / GE for 'GE dishwasher'", () => {
    const s = suggestFromName("GE dishwasher");
    expect(s?.category).toBe("appliance");
    expect(s?.subtypeLabel).toMatch(/dishwasher/i);
    expect(s?.manufacturer).toBe("GE");
  });

  it("does not false-positive match 'GE' inside other words", () => {
    // "range" contains the substring "ge" but is not the GE brand.
    const s = suggestFromName("Large range");
    expect(s?.manufacturer).not.toBe("GE");
  });

  it("suggests system / gutters with no manufacturer for 'Gutters'", () => {
    const s = suggestFromName("Gutters");
    expect(s?.category).toBe("system");
    expect(s?.subtypeLabel).toMatch(/gutter/i);
    expect(s?.manufacturer).toBeNull();
  });

  it("returns null for an empty or unrecognized name", () => {
    expect(suggestFromName("")).toBeNull();
    expect(suggestFromName("   ")).toBeNull();
    expect(suggestFromName("Antique lamp")).toBeNull();
  });

  it("picks the more specific keyword when multiple subtypes could match", () => {
    // "Honda Odyssey" contains no generic body-style word, only the minivan
    // model name, so only vehicle_minivan matches.
    const s = suggestFromName("Honda Odyssey");
    expect(s?.category).toBe("vehicle");
    expect(s?.subtypeLabel).toMatch(/minivan/i);
    expect(s?.manufacturer).toBe("Honda");
  });
});

describe("listManufacturerOptions", () => {
  it("returns vehicle makes for category vehicle", () => {
    const options = listManufacturerOptions("vehicle");
    expect(options).toContain("Tesla");
    expect(options).toContain("Honda");
  });

  it("returns appliance manufacturers for category appliance and system", () => {
    expect(listManufacturerOptions("appliance")).toContain("GE");
    expect(listManufacturerOptions("system")).toContain("Rheem");
  });

  it("returns no options for categories without manufacturer data", () => {
    expect(listManufacturerOptions("furniture")).toEqual([]);
    expect(listManufacturerOptions("electronics")).toEqual([]);
    expect(listManufacturerOptions("other")).toEqual([]);
  });
});
