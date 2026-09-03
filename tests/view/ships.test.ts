import { describe, it, expect } from "vitest";
import {
  assembledShips, bonusLabel, errorShipCard, fitValueEntries, gauge, shipLocationLabel,
  shipCardStats, sortShipCards, stripBonusMarkup, toShipCard,
} from "../../src/lib/view/ships.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";

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

function asset(over: Partial<AssetRow> & { itemId: number; typeId: number }): AssetRow {
  return {
    quantity: 1, locationId: 60003760, locationType: "station", locationFlag: "Hangar",
    isSingleton: false, isBlueprintCopy: false, name: null, ...over,
  };
}

/** A stand-in for DogmaData: assembledShips and shipLocationLabel only read `types`. */
const data = {
  types: new Map([
    [587, { id: 587, groupId: 25, categoryId: 6, name: "Rifter", attrs: new Map(), effects: new Map() }],
    [519, { id: 519, groupId: 76, categoryId: 7, name: "Gyrostabilizer II", attrs: new Map(), effects: new Map() }],
    [28606, { id: 28606, groupId: 448, categoryId: 6, name: "Orca", attrs: new Map(), effects: new Map() }],
  ]),
  attributes: new Map(), effects: new Map(), groups: new Map(),
} as unknown as import("../../src/lib/dogma/index.js").DogmaData;

describe("assembledShips", () => {
  it("finds assembled hulls and the items sitting inside them", () => {
    const rows = [
      asset({ itemId: 1, typeId: 587, isSingleton: true, name: "Scarlet Dart" }),
      asset({ itemId: 2, typeId: 519, isSingleton: true, locationId: 1, locationType: "item", locationFlag: "LoSlot0" }),
      asset({ itemId: 3, typeId: 519, quantity: 4 }),                       // a packaged stack in the hangar
      asset({ itemId: 4, typeId: 587, quantity: 2 }),                       // packaged hulls: not assembled
    ];
    const groups = assembledShips(rows, data);
    expect(groups).toHaveLength(1);
    expect(groups[0].ship.itemId).toBe(1);
    expect(groups[0].children.map((c) => c.itemId)).toEqual([2]);
  });

  it("gives a ship inside another ship its own group", () => {
    const rows = [
      asset({ itemId: 1, typeId: 28606, isSingleton: true }),
      asset({ itemId: 2, typeId: 587, isSingleton: true, locationId: 1, locationType: "item", locationFlag: "ShipHangar" }),
    ];
    expect(assembledShips(rows, data).map((g) => g.ship.itemId)).toEqual([1, 2]);
  });

  it("ignores a hull whose type the SDE does not know", () => {
    expect(assembledShips([asset({ itemId: 1, typeId: 999999, isSingleton: true })], data)).toEqual([]);
  });
});

describe("shipLocationLabel", () => {
  const places = new Map([[60003760, { name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant" }]]);

  it("names the place a ship is parked in", () => {
    const ship = asset({ itemId: 1, typeId: 587, isSingleton: true });
    expect(shipLocationLabel(ship, places, new Map(), data)).toBe("Jita IV - Moon 4 - Caldari Navy Assembly Plant");
  });

  it("falls back to a readable placeholder for an unresolved place", () => {
    const ship = asset({ itemId: 1, typeId: 587, locationId: 60000001 });
    expect(shipLocationLabel(ship, places, new Map(), data)).toBe("Unknown location (60000001)");
  });

  it("names the containing ship when the parent is an item", () => {
    const carrier = asset({ itemId: 9, typeId: 28606, isSingleton: true, name: "Mule" });
    const ship = asset({ itemId: 1, typeId: 587, locationId: 9, locationType: "item", locationFlag: "ShipHangar" });
    expect(shipLocationLabel(ship, places, new Map([[9, carrier]]), data)).toBe("Mule");
    const unnamed = { ...carrier, name: null };
    expect(shipLocationLabel(ship, places, new Map([[9, unnamed]]), data)).toBe("Orca");
    expect(shipLocationLabel(ship, places, new Map(), data)).toBe("Container 9");
  });
});

describe("toShipCard / errorShipCard / sortShipCards", () => {
  const stats = {
    cpu: { used: 121.5, output: 162.5 }, power: { used: 30, output: 51.25 },
    calibration: { used: 0, output: 400 },
    slots: { high: { used: 1, total: 4 }, mid: { used: 0, total: 3 }, low: { used: 1, total: 3 }, rig: { used: 0, total: 3 }, subsystem: { used: 0, total: 0 } },
    hardpoints: { turret: { used: 1, total: 3 }, launcher: { used: 0, total: 2 } },
    modules: [],
  } as unknown as import("../../src/lib/dogma/index.js").FitStats;
  const base = {
    key: "asset:1", href: "/ships/asset/1", name: "Scarlet Dart", typeId: 587, typeName: "Rifter",
    groupName: "Frigate", raceName: "Minmatar", location: "Jita 4-4",
  };

  it("formats the four headline stats, dashes and a null cap colour where the engine can't answer", () => {
    const perf = {
      dps: 863.24, ehp: 37444.6, maxVelocity: 289.1, capStable: { stable: true, level: 0.684 }, propulsion: null,
    } as unknown as import("../../src/lib/dogma/index.js").FitPerformance;
    expect(shipCardStats(perf)).toEqual({ dps: "863.2", ehp: "37,445", velocity: "289 m/s", cap: "Stable 68%", capOk: true, propKind: null });
    // A running prop mod takes over the speed tile and names itself.
    const mwd = { ...perf, propulsion: { kind: "Microwarpdrive", velocity: 2146.7, alignTime: 8.2, signatureRadius: 218 } } as unknown as import("../../src/lib/dogma/index.js").FitPerformance;
    expect(shipCardStats(mwd)).toMatchObject({ velocity: "2,147 m/s", propKind: "MWD" });
    const draining = { ...perf, dps: null, capStable: { stable: false, lastsSeconds: 243 } } as unknown as import("../../src/lib/dogma/index.js").FitPerformance;
    expect(shipCardStats(draining)).toMatchObject({ dps: "—", cap: "Lasts 4m 3s", capOk: false });
    expect(shipCardStats({ ...perf, capStable: null } as never)).toMatchObject({ cap: "—", capOk: null });
    // Without a perf the card has no strip at all.
    expect(toShipCard({ ...base, stats, problems: [], entries: [], prices: new Map() }).stats).toBeNull();
    expect(toShipCard({ ...base, stats, problems: [], entries: [], prices: new Map(), perf }).stats?.ehp).toBe("37,445");
  });

  it("builds a card with both gauges, the missing-skill count and the value", () => {
    const card = toShipCard({
      ...base, stats,
      problems: [
        { kind: "skill", detail: "Minmatar Frigate I required", skill: { skillTypeId: 3329, required: 1, have: 0 } },
        { kind: "cpu", detail: "CPU over" },
      ] as unknown as import("../../src/lib/dogma/index.js").Problem[],
      entries: [{ typeId: 587, quantity: 1 }],
      prices: new Map([[587, { sell: 8_000_000, buy: null, adjusted: null }]]),
    });
    expect(card.cpu!.text).toBe("121.50 / 162.50 tf");
    expect(card.power!.over).toBe(false);
    expect(card.missingSkills).toBe(1);
    expect(card.value).toBe("8.0M ISK");
    expect(card.valueRaw).toBe(8_000_000);
    expect(card.unpriced).toBeNull();
    expect(card.error).toBeNull();
  });

  it("reports unpriced entries", () => {
    const card = toShipCard({ ...base, stats, problems: [], entries: [{ typeId: 587, quantity: 1 }], prices: new Map() });
    expect(card.value).toBe("0 ISK");
    expect(card.unpriced).toBe("1 item unpriced");
  });

  it("builds a could-not-compute card with no gauges, sorted last", () => {
    const broken = errorShipCard(base);
    expect(broken.error).toBe("Could not compute");
    expect(broken.cpu).toBeNull();
    expect(broken.power).toBeNull();
    const worthless = toShipCard({ ...base, key: "asset:2", stats, problems: [], entries: [], prices: new Map() });
    expect(sortShipCards([broken, worthless]).map((c) => c.key)).toEqual(["asset:2", "asset:1"]);
  });

  it("sorts by value descending", () => {
    const make = (key: string, sell: number) => toShipCard({
      ...base, key, stats, problems: [], entries: [{ typeId: 587, quantity: 1 }],
      prices: new Map([[587, { sell, buy: null, adjusted: null }]]),
    });
    expect(sortShipCards([make("a", 10), make("b", 900), make("c", 100)]).map((c) => c.key)).toEqual(["b", "c", "a"]);
  });
});
