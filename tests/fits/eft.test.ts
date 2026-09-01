import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { CATEGORY } from "../../src/lib/dogma/index.js";
import { assignEftItems, exportEft, tokeniseEft } from "../../src/lib/fits/eft.js";
import type { FitDoc } from "../../src/lib/fits/doc.js";

const data = fixtureData("rifter");
const RIFTER = { high: 3, mid: 3, low: 4, rig: 3, subsystem: 0 };

const FIXTURE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "fits", "rifter.eft"),
  "utf8",
).replace(/\n$/, "");

/** Every type in the snapshot, keyed by lower-cased name — what the import route builds from SQL. */
const byName = new Map<string, number>();
for (const type of data.types.values()) if (type.name !== null) byName.set(type.name.toLowerCase(), type.id);

describe("tokeniseEft", () => {
  it("reads the header, the charges, the quantities, the offline suffix and the empty markers", () => {
    const parsed = tokeniseEft(FIXTURE)!;
    expect(parsed.shipName).toBe("Rifter");
    expect(parsed.fitName).toBe("Cheap Rifter");
    expect(parsed.lines[0]).toEqual(
      { name: "Damage Control II", chargeName: null, quantity: 1, offline: true, empty: null });
    expect(parsed.lines[2]).toEqual(
      { name: "", chargeName: null, quantity: 1, offline: false, empty: "low" });
    expect(parsed.lines.find((l) => l.chargeName !== null)).toEqual(
      { name: "200mm AutoCannon II", chargeName: "Hail S", quantity: 1, offline: false, empty: null });
    expect(parsed.lines.at(-1)).toEqual(
      { name: "Hail S", chargeName: null, quantity: 600, offline: false, empty: null });
  });

  it("returns null when there is no header line", () => {
    expect(tokeniseEft("Damage Control II\n")).toBeNull();
  });
});

describe("assignEftItems", () => {
  it("assigns slots by marker effect in the order listed, empties included", () => {
    const assigned = assignEftItems(tokeniseEft(FIXTURE)!, byName, data)!;
    expect(assigned.shipTypeId).toBe(587);
    expect(assigned.name).toBe("Cheap Rifter");
    expect(assigned.items.map((i) => [i.flag, i.typeId, i.chargeTypeId, i.state, i.quantity])).toEqual([
      ["LoSlot0", 2048, null, "offline", 1],
      ["LoSlot1", 519, null, "online", 1],
      ["MedSlot0", 440, null, "active", 1],
      ["MedSlot1", 5443, null, "active", 1],
      ["MedSlot2", 380, null, "online", 1],
      ["HiSlot0", 2889, 12608, "active", 1],
      ["HiSlot1", 2889, 12608, "active", 1],
      ["RigSlot0", 31686, null, "online", 1],
      ["DroneBay", 2456, null, "active", 2],
      ["Cargo", 12608, null, "active", 600],
    ]);
    expect(assigned.unresolved).toEqual([]);
  });

  it("reports names this SDE build does not know, and keeps the rest", () => {
    const text = "[Rifter, Typo]\nDamage Control II\nDamage Controll II\n";
    const assigned = assignEftItems(tokeniseEft(text)!, byName, data)!;
    expect(assigned.items.map((i) => i.typeId)).toEqual([2048]);
    expect(assigned.unresolved).toEqual(["Damage Controll II"]);
  });

  it("returns null when the hull itself cannot be resolved", () => {
    expect(assignEftItems(tokeniseEft("[Wormhole, x]\nDamage Control II\n")!, byName, data)).toBeNull();
  });

  it("matches names case-insensitively", () => {
    const assigned = assignEftItems(tokeniseEft("[rifter, lower]\ndamage control ii\n")!, byName, data)!;
    expect(assigned.items.map((i) => [i.flag, i.typeId])).toEqual([["LoSlot0", 2048]]);
  });
});

describe("exportEft", () => {
  const doc = (): FitDoc => {
    const assigned = assignEftItems(tokeniseEft(FIXTURE)!, byName, data)!;
    return {
      id: 7, name: assigned.name, description: "", shipTypeId: assigned.shipTypeId,
      characterId: "all-v", items: assigned.items,
    };
  };

  it("round-trips the fixture exactly", () => {
    expect(exportEft(doc(), data, RIFTER)).toBe(FIXTURE);
  });

  it("names a type this SDE build does not know instead of crashing", () => {
    const broken = { ...doc(), items: [{ typeId: 999999, quantity: 1, flag: "LoSlot0", chargeTypeId: null, state: "active" as const }] };
    expect(exportEft(broken, data, RIFTER)).toContain("Unknown type (999999)");
  });

  it("keeps drones out of the cargo section", () => {
    expect(CATEGORY.drone).toBe(18);
    const text = exportEft(doc(), data, RIFTER);
    expect(text.indexOf("Hobgoblin II x2")).toBeLessThan(text.indexOf("Hail S x600"));
  });
});
