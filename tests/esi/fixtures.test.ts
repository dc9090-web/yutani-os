import { describe, it, expect } from "vitest";
import { esiFixture } from "../fixtures/esi.js";

describe("ESI fixtures", () => {
  it("skillqueue has a completed entry, a future entry and a paused entry with no dates", () => {
    const queue = esiFixture<Record<string, unknown>[]>("skillqueue");
    expect(queue).toHaveLength(3);
    expect(queue[0].finish_date).toBe("2026-08-31T18:30:00Z");
    expect(queue[2]).not.toHaveProperty("start_date");
    expect(queue[2]).not.toHaveProperty("finish_date");
    expect(queue[2]).not.toHaveProperty("level_end_sp");
  });
  it("skills omits nothing required and attributes may omit the remap fields", () => {
    const skills = esiFixture<{ total_sp: number; unallocated_sp?: number; skills: unknown[] }>("skills");
    expect(skills.total_sp).toBeGreaterThan(0);
    expect(skills.skills).toHaveLength(4);
    expect(esiFixture<Record<string, unknown>>("attributes").intelligence).toBe(24);
  });
  it("assets contain an item with no is_blueprint_copy, a BPC, and a nested module", () => {
    const assets = esiFixture<Record<string, unknown>[]>("assets");
    expect(assets.filter((a) => "is_blueprint_copy" in a)).toHaveLength(1);
    expect(assets.some((a) => a.location_type === "item")).toBe(true);
    expect(assets.some((a) => a.location_type === "other")).toBe(true);
  });
  it("clones contain a jump clone with an empty implants array and no name", () => {
    const clones = esiFixture<{ jump_clones: Record<string, unknown>[] }>("clones");
    expect(clones.jump_clones[1].implants).toEqual([]);
    expect(clones.jump_clones[1]).not.toHaveProperty("name");
  });
  it("fittings contain an Invalid flag and an empty description", () => {
    const fittings = esiFixture<{ description: string; items: { flag: string }[] }[]>("fittings");
    expect(fittings[0].description).toBe("");
    expect(fittings[0].items.map((i) => i.flag)).toContain("Invalid");
  });
  it("the wallet balance is a bare number and one journal row has no amount", () => {
    expect(typeof esiFixture<number>("wallet-balance")).toBe("number");
    const journal = esiFixture<Record<string, unknown>[]>("wallet-journal");
    expect(journal.filter((j) => !("amount" in j))).toHaveLength(1);
    expect(journal.some((j) => "tax" in j)).toBe(true);
  });
  it("location is in space, and ship/online are complete", () => {
    const location = esiFixture<Record<string, unknown>>("location");
    expect(location.solar_system_id).toBe(30000142);
    expect(location).not.toHaveProperty("station_id");
    expect(location).not.toHaveProperty("structure_id");
    expect(esiFixture<Record<string, unknown>>("ship").ship_item_id).toBe(1023456789012);
    expect(esiFixture<Record<string, unknown>>("online").online).toBe(true);
  });
  it("universe-names covers several categories and universe-structure has no position requirement", () => {
    const names = esiFixture<{ category: string }[]>("universe-names");
    expect(new Set(names.map((n) => n.category)).size).toBeGreaterThanOrEqual(4);
    expect(esiFixture<Record<string, unknown>>("universe-structure").solar_system_id).toBe(30000144);
    expect(esiFixture<Record<string, unknown>[]>("assets-names")).toHaveLength(5);
    expect(esiFixture<Record<string, unknown>[]>("wallet-transactions")).toHaveLength(2);
    expect(esiFixture<number[]>("implants")).toHaveLength(5);
  });
  it("throws for a fixture name with no matching file", () => {
    expect(() => esiFixture("does-not-exist")).toThrow();
  });
});
