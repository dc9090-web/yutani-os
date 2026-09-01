import { describe, it, expect, beforeEach, vi } from "vitest";
import { fixtureData } from "../dogma/fixture.js";
import { serialiseMeta, serialiseTypes } from "../../src/lib/dogma/serialize.js";
import {
  TYPE_CHUNK, allVSkillIds, dogmaData, ensureTypes, getDogmaMeta, pricesFor, resetDogmaStore,
  skillContext,
} from "../../src/lib/fits/client-data.js";

const data = fixtureData("rifter");
const META = serialiseMeta(data, 3484357);
const ALL_TYPES = serialiseTypes(data);

let calls: string[] = [];

function fakeFetch(handler: (url: string) => unknown): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return { ok: true, status: 200, json: async () => handler(url) } as Response;
  }) as typeof fetch;
}

const server = fakeFetch((url) => {
  if (url.startsWith("/api/dogma/meta")) return META;
  if (url.startsWith("/api/dogma/types")) {
    const ids = new Set((new URL(url, "https://x").searchParams.get("ids") ?? "").split(",").map(Number));
    return { build: 3484357, types: ALL_TYPES.filter((t) => ids.has(t.id)) };
  }
  if (url.startsWith("/api/sde/types")) {
    return { types: ALL_TYPES.filter((t) => t.categoryId === 16).map((t) => ({ id: t.id, name: t.name })) };
  }
  if (url.startsWith("/api/characters/")) {
    return { skills: [{ skillId: 3426, level: 5 }], implants: [27143] };
  }
  if (url.startsWith("/api/market/prices")) {
    return { prices: { "587": { sell: 8000000, buy: null, adjusted: null } } };
  }
  throw new Error(`unexpected url ${url}`);
});

beforeEach(() => { resetDogmaStore(); calls = []; });

describe("the browser dogma store", () => {
  it("fetches the meta once, however many callers ask", async () => {
    const [a, b] = await Promise.all([getDogmaMeta(server), getDogmaMeta(server)]);
    expect(a).toBe(b);
    expect(a.build).toBe(3484357);
    expect(calls.filter((c) => c.startsWith("/api/dogma/meta"))).toHaveLength(1);
  });

  it("memoises types per id and never asks twice", async () => {
    await getDogmaMeta(server);
    await ensureTypes([587, 2889], server);
    await ensureTypes([2889, 2048], server);
    const typeCalls = calls.filter((c) => c.startsWith("/api/dogma/types"));
    expect(typeCalls).toHaveLength(2);
    expect(typeCalls[0]).toContain("ids=587%2C2889");
    expect(typeCalls[1]).toContain("ids=2048");
    expect(dogmaData().types.get(587)?.name).toBe("Rifter");
  });

  it("chunks large id lists", async () => {
    await getDogmaMeta(server);
    await ensureTypes(Array.from({ length: TYPE_CHUNK + 5 }, (_, i) => 100000 + i), server);
    expect(calls.filter((c) => c.startsWith("/api/dogma/types"))).toHaveLength(2);
  });

  it("does not re-request ids the server does not know", async () => {
    await getDogmaMeta(server);
    await ensureTypes([999999], server);
    await ensureTypes([999999], server);
    expect(calls.filter((c) => c.startsWith("/api/dogma/types"))).toHaveLength(1);
  });

  it("throws a clear error if the engine is asked for data before the meta lands", () => {
    expect(() => dogmaData()).toThrow(/meta/i);
  });

  it("builds an All-V context from every skill type, and loads their types", async () => {
    await getDogmaMeta(server);
    const context = await skillContext("all-v", server);
    expect(context.synced).toBe(true);
    expect(context.implants).toEqual([]);
    expect(context.skills.get(11207)).toBe(5);          // Advanced Weapon Upgrades, not a required skill
    expect(dogmaData().types.has(11207)).toBe(true);
    expect((await allVSkillIds(server)).length).toBeGreaterThan(0);
    // The id list is fetched once and reused.
    await skillContext("all-v", server);
    expect(calls.filter((c) => c.startsWith("/api/sde/types"))).toHaveLength(1);
  });

  it("builds a character context from the skills route and loads those types", async () => {
    await getDogmaMeta(server);
    const context = await skillContext(669539978, server);
    expect(context.skills.get(3426)).toBe(5);
    expect(context.implants).toEqual([27143]);
    expect(context.synced).toBe(true);
    expect(dogmaData().types.has(3426)).toBe(true);
  });

  it("degrades to an unsynced empty context when the skills route fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await getDogmaMeta(server);
    const broken = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    await expect(skillContext(669539978, broken)).resolves.toEqual({
      skills: new Map(), implants: [], synced: false,
    });
    logged.mockRestore();
  });

  it("fetches prices and hands back a Map", async () => {
    const prices = await pricesFor([587], server);
    expect(prices.get(587)).toEqual({ sell: 8000000, buy: null, adjusted: null });
    expect(await pricesFor([], server)).toEqual(new Map());
  });
});
