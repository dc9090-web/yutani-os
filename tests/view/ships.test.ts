import { describe, it, expect } from "vitest";
import { bonusLabel, gauge, stripBonusMarkup } from "../../src/lib/view/ships.js";

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

describe("gauge", () => {
  it("formats the used/output pair to two decimals and computes the percentage", () => {
    expect(gauge("CPU", "tf", { used: 121.5, output: 162.5 })).toEqual({
      label: "CPU", unit: "tf", used: 121.5, output: 162.5,
      text: "121.50 / 162.50 tf", percent: 74.8, over: false,
    });
  });
  it("marks an over-budget pool and clamps the bar at 100 %", () => {
    const g = gauge("Powergrid", "MW", { used: 60, output: 51.25 });
    expect(g.over).toBe(true);
    expect(g.percent).toBe(100);
  });
  it("uses whole numbers when asked, for calibration, and trims a blank unit", () => {
    expect(gauge("Calibration", "", { used: 300, output: 400 }, 0).text).toBe("300 / 400");
  });
  it("treats any usage of a zero output as full and over", () => {
    expect(gauge("Powergrid", "MW", { used: 5, output: 0 })).toMatchObject({ percent: 100, over: true });
    expect(gauge("Powergrid", "MW", { used: 0, output: 0 })).toMatchObject({ percent: 0, over: false });
  });
});
