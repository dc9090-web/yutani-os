import { describe, it, expect, vi } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { CATEGORY } from "../../src/lib/dogma/index.js";
import { CARGO_FLAG, type FitDoc, type FitItem } from "../../src/lib/fits/doc.js";
import { computeEditor, fitTypeIds, typeIconUrl } from "../../src/lib/fits/editor-view.js";
import type { Price } from "../../src/lib/view/price.js";

const data = fixtureData("rifter");
const allV = new Map<number, number>();
for (const t of data.types.values()) if (t.categoryId === CATEGORY.skill) allV.set(t.id, 5);

const ctxAllV = { data, skills: allV, implants: [] };
const ctxNone = { data, skills: new Map<number, number>(), implants: [] };
const PRICES = new Map<number, Price>([
  [587, { sell: 8_000_000, buy: null, adjusted: null }],
  [2889, { sell: 1_500_000, buy: null, adjusted: null }],
]);

function item(over: Partial<FitItem> & { typeId: number; flag: string }): FitItem {
  return { quantity: 1, chargeTypeId: null, state: "active", ...over };
}
function doc(items: FitItem[]): FitDoc {
  return { id: 1, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: "all-v", items };
}

const THREE_GUNS = doc([0, 1, 2].map((i) => item({ typeId: 2889, flag: `HiSlot${i}`, chargeTypeId: 12608 })));

describe("fitTypeIds", () => {
  it("collects the hull, every item and every charge", () => {
    expect(fitTypeIds(THREE_GUNS).sort((a, b) => a - b)).toEqual([587, 2889, 12608]);
  });
});

describe("computeEditor", () => {
  it("builds the gauges, the counters and the slot blocks from real engine numbers", () => {
    const result = computeEditor(THREE_GUNS, ctxAllV, PRICES);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.totals).toEqual({ high: 3, mid: 3, low: 4, rig: 3, subsystem: 0 });
    // 3 × 6.75 tf and 3 × 3.60 MW at all skills V.
    expect(result.view.gauges.map((g) => g.text)).toEqual([
      "20.25 / 162.50 tf", "10.80 / 51.25 MW", "0.00 / 400.00",
    ]);
    expect(result.view.gauges.every((g) => !g.over)).toBe(true);
    expect(result.view.counters).toEqual([
      { label: "High", used: 3, total: 3, over: false },
      { label: "Mid", used: 0, total: 3, over: false },
      { label: "Low", used: 0, total: 4, over: false },
      { label: "Rigs", used: 0, total: 3, over: false },
      { label: "Turrets", used: 3, total: 3, over: false },
      { label: "Launchers", used: 0, total: 2, over: false },
    ]);

    const high = result.view.blocks.find((b) => b.slot === "high")!;
    expect(high.rows.map((r) => r.name)).toEqual(
      ["200mm AutoCannon II", "200mm AutoCannon II", "200mm AutoCannon II"]);
    expect(high.rows[0]).toMatchObject({
      key: "high:0", cpu: "6.75", power: "3.60", state: "active", over: false,
      charge: { typeId: 12608, name: "Hail S" }, iconUrl: typeIconUrl(2889),
      desc: "200mm AutoCannon II — Projectile Weapon",
    });
    expect(high.rows[0].states).toEqual(["offline", "online", "active", "overload"]);
    expect(high.rows[0].cpuExplain.length).toBeGreaterThan(0);

    // A hull with no subsystems contributes no block at all.
    expect(result.view.blocks.map((b) => b.slot)).toEqual(["high", "mid", "low", "rig"]);
    const low = result.view.blocks.find((b) => b.slot === "low")!;
    expect(low.rows).toHaveLength(4);
    expect(low.rows[0]).toMatchObject({ typeId: null, name: "Empty", state: null, cpu: "—" });
  });

  it("has no problems at all skills V and lists named missing skills at none", () => {
    const good = computeEditor(THREE_GUNS, ctxAllV, PRICES);
    expect(good.kind === "ok" && good.view.problems).toEqual([]);
    expect(good.kind === "ok" && good.view.missing).toEqual([]);

    const bad = computeEditor(THREE_GUNS, ctxNone, PRICES);
    if (bad.kind !== "ok") throw new Error("expected ok");
    expect(bad.view.missing.map((m) => m.name)).toContain("Minmatar Frigate");
    expect(bad.view.missing.find((m) => m.name === "Minmatar Frigate")).toMatchObject({ have: 0, need: 1 });
    expect(bad.view.problems.some((p) => p.kind === "skill")).toBe(true);
  });

  it("marks the over-count slot and raises the slot problem", () => {
    const four = doc([0, 1, 2, 3].map((i) => item({ typeId: 2889, flag: `HiSlot${i}` })));
    const result = computeEditor(four, ctxAllV, PRICES);
    if (result.kind !== "ok") throw new Error("expected ok");
    const high = result.view.blocks.find((b) => b.slot === "high")!;
    expect(high.rows).toHaveLength(4);
    expect(high.rows[3].over).toBe(true);
    expect(result.view.counters[0]).toEqual({ label: "High", used: 4, total: 3, over: true });
    expect(result.view.problems.map((p) => p.kind)).toContain("slot");
  });

  it("charges an offline module nothing", () => {
    const offline = doc([
      item({ typeId: 2889, flag: "HiSlot0" }),
      item({ typeId: 2048, flag: "LoSlot0", state: "offline" }),
    ]);
    const result = computeEditor(offline, ctxAllV, PRICES);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.view.gauges[0].text).toBe("6.75 / 162.50 tf");
    const low = result.view.blocks.find((b) => b.slot === "low")!;
    expect(low.rows[0]).toMatchObject({ name: "Damage Control II", cpu: "0.00", state: "offline" });
  });

  it("lists drones, cargo and unknown types, and rolls the value up", () => {
    const stocked = doc([
      item({ typeId: 2889, flag: "HiSlot0" }),
      item({ typeId: 2456, flag: "DroneBay", quantity: 2 }),
      item({ typeId: 12608, flag: CARGO_FLAG, quantity: 600 }),
      item({ typeId: 999999, flag: "MedSlot0" }),
    ]);
    const result = computeEditor(stocked, ctxAllV, PRICES);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.view.drones).toEqual([
      {
        key: "DroneBay:2456", typeId: 2456, flag: "DroneBay", name: "Hobgoblin II", quantity: 2, value: null,
        desc: "Hobgoblin II — Combat Drone",
      },
    ]);
    expect(result.view.cargo[0]).toMatchObject({ typeId: 12608, name: "Hail S", quantity: 600 });
    expect(result.view.unknown).toEqual([
      {
        key: "MedSlot0:999999", typeId: 999999, flag: "MedSlot0", name: "Unknown type (999999)", quantity: 1,
        value: null, desc: "Unknown type (999999)",
      },
    ]);
    // 8,000,000 (hull) + 1,500,000 (gun); the drones and ammo have no price.
    expect(result.view.value.total).toBe("9.5M ISK");
    expect(result.view.value.unpriced).toContain("2 items");
  });

  it("returns an error result and logs when the engine throws", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(computeEditor(doc([]), { ...ctxAllV, data: { ...data, types: new Map() } }, PRICES))
      .toEqual({ kind: "error" });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
