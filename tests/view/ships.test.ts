import { describe, it, expect } from "vitest";
import { bonusLabel, stripBonusMarkup } from "../../src/lib/view/ships.js";

describe("stripBonusMarkup", () => {
  it("removes the SDE's showinfo anchors", () => {
    expect(stripBonusMarkup("bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire"))
      .toBe("bonus to Small Projectile Turret rate of fire");
  });
  it("leaves plain text alone", () => {
    expect(stripBonusMarkup("Can fit Covert Ops Cloaking Devices")).toBe("Can fit Covert Ops Cloaking Devices");
  });
});

describe("bonusLabel", () => {
  it("puts a percentage in front of the stripped text", () => {
    expect(bonusLabel({
      bonus: 7.5, unitId: 105,
      bonusText: "bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire",
    })).toBe("7.5% bonus to Small Projectile Turret rate of fire");
  });
  it("renders a non-percentage unit as a bare number", () => {
    expect(bonusLabel({ bonus: 3, unitId: 1, bonusText: "extra <a href=showinfo:1>metres</a>" }))
      .toBe("3 extra metres");
  });
  it("renders a role bonus with no numeric value as just its text", () => {
    expect(bonusLabel({ bonus: null, unitId: null, bonusText: "Can fit Covert Ops Cloaking Devices" }))
      .toBe("Can fit Covert Ops Cloaking Devices");
  });
  it("survives a bonus with no text at all", () => {
    expect(bonusLabel({ bonus: 5, unitId: 105, bonusText: null })).toBe("5%");
    expect(bonusLabel({ bonus: null, unitId: null, bonusText: null })).toBe("");
  });
});
