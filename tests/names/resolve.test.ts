import { describe, it, expect, vi } from "vitest";
import { createNameResolver, UNKNOWN_TTL_MS, VOLATILE_TTL_MS, STRUCTURE_TTL_MS, type NameResolverDeps } from "../../src/lib/names/resolve.js";
import { EsiError } from "../../src/lib/esi/client.js";
import type { UniverseName, StructureRow } from "../../src/lib/db/names.js";

const NOW = Date.UTC(2026, 8, 1, 12, 0, 0);
const KNOWN: Record<number, { name: string; category: string }> = {
  669539978: { name: "TrilliumONE", category: "character" },
  1000035: { name: "Caldari Navy", category: "corporation" },
  34: { name: "Tritanium", category: "inventory_type" },
  60003760: { name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", category: "station" },
};

function harness(over: Partial<NameResolverDeps> = {}) {
  const names = new Map<number, UniverseName>();
  const structures = new Map<number, StructureRow>();
  const posts: number[][] = [];
  const gets: string[] = [];
  const deps: NameResolverDeps = {
    esi: {
      post: vi.fn(async (_path: string, body: unknown) => {
        const ids = body as number[];
        posts.push(ids);
        if (ids.some((id) => !(id in KNOWN))) throw new EsiError(404, "/universe/names", "Ensure all IDs are valid before resolving");
        return ids.map((id) => ({ id, ...KNOWN[id] }));
      }),
      get: vi.fn(async (path: string) => {
        gets.push(path);
        return { data: { name: "Perimeter - Tranquility Trading Tower", owner_id: 98599770, solar_system_id: 30000144, type_id: 35834 } };
      }),
    } as unknown as NameResolverDeps["esi"],
    getNames: async (ids) => ids.map((id) => names.get(id)).filter((r): r is UniverseName => r !== undefined),
    putNames: async (rows) => { for (const r of rows) names.set(r.id, { ...r, updatedAt: new Date(NOW) }); return rows.length; },
    getStructures: async (ids) => ids.map((id) => structures.get(id)).filter((r): r is StructureRow => r !== undefined),
    putStructure: async (row) => { structures.set(row.id, { ...row, updatedAt: new Date(NOW) }); },
    getSolarSystem: async (id) => (id === 30000142 ? { id, name: "Jita" } : null),
    getStation: async (id) => (id === 60003760 ? { id, solarSystemId: 30000142 } : null),
    hasStructureScope: async () => true,
    now: () => NOW,
    ...over,
  };
  return { resolver: createNameResolver(deps), deps, names, structures, posts, gets };
}

const stored = (id: number, category: string, name: string | null, ageMs: number): UniverseName =>
  ({ id, category, name, updatedAt: new Date(NOW - ageMs) });

describe("resolveNames", () => {
  it("serves fresh rows from universe_names without calling ESI", async () => {
    const h = harness();
    h.names.set(34, stored(34, "inventory_type", "Tritanium", 400 * 24 * 3600e3));
    const out = await h.resolver.resolveNames([34, 34]);
    expect(out.get(34)).toEqual({ name: "Tritanium", category: "inventory_type" });
    expect(h.posts).toEqual([]);
  });
  it("refreshes character/corporation/alliance rows older than 30 days", async () => {
    const h = harness();
    h.names.set(669539978, stored(669539978, "character", "Old Name", VOLATILE_TTL_MS + 1000));
    const out = await h.resolver.resolveNames([669539978]);
    expect(h.posts).toEqual([[669539978]]);
    expect(out.get(669539978)!.name).toBe("TrilliumONE");
  });
  it("posts only the ids it does not already have, deduplicated, ignoring junk", async () => {
    const h = harness();
    h.names.set(34, stored(34, "inventory_type", "Tritanium", 0));
    await h.resolver.resolveNames([34, 1000035, 1000035, 0, -7, 1.5]);
    expect(h.posts).toEqual([[1000035]]);
  });
  it("bisects a 404 batch and caches the unresolvable id as 'unknown'", async () => {
    const h = harness();
    const out = await h.resolver.resolveNames([669539978, 999999999, 34]);
    expect(out.get(669539978)!.name).toBe("TrilliumONE");
    expect(out.get(34)!.name).toBe("Tritanium");
    expect(out.get(999999999)).toEqual({ name: null, category: "unknown" });
    expect(h.names.get(999999999)!.category).toBe("unknown");
    expect(h.posts.length).toBeGreaterThan(1);            // the whole batch, then halves, then singles
    expect(h.posts[0]).toEqual([669539978, 999999999, 34]);
  });
  it("does not retry an unknown id for 7 days, then does", async () => {
    const fresh = harness();
    fresh.names.set(999999999, stored(999999999, "unknown", null, UNKNOWN_TTL_MS - 1000));
    expect((await fresh.resolver.resolveNames([999999999])).get(999999999)).toEqual({ name: null, category: "unknown" });
    expect(fresh.posts).toEqual([]);
    const stale = harness();
    stale.names.set(999999999, stored(999999999, "unknown", null, UNKNOWN_TTL_MS + 1000));
    await stale.resolver.resolveNames([999999999]);
    expect(stale.posts).toEqual([[999999999]]);
  });
  it("chunks to 1000 ids per POST", async () => {
    const ids = Array.from({ length: 1500 }, (_, i) => 34);   // deduplicated to one
    const h = harness();
    await h.resolver.resolveNames(ids);
    expect(h.posts).toEqual([[34]]);
    const manyPosts: number[][] = [];
    const many = harness({
      esi: {
        post: async (_p: string, body: unknown) => {
          manyPosts.push(body as number[]);
          return (body as number[]).map((id) => ({ id, name: `n${id}`, category: "inventory_type" }));
        },
        get: async () => ({ data: {} }),
      } as unknown as NameResolverDeps["esi"],
    });
    await many.resolver.resolveNames(Array.from({ length: 2500 }, (_, i) => 1_000_000 + i));
    expect(manyPosts.length).toBe(3);
    expect(manyPosts.map((p) => p.length)).toEqual([1000, 1000, 500]);
    expect(many.names.size).toBe(2500);
  });
  it("returns an empty map for no usable ids", async () => {
    const h = harness();
    expect((await h.resolver.resolveNames([])).size).toBe(0);
    expect((await h.resolver.resolveNames([0, -1])).size).toBe(0);
    expect(h.posts).toEqual([]);
  });
  it("lets a non-404 ESI error propagate", async () => {
    const h = harness({ esi: { post: async () => { throw new EsiError(503, "/universe/names", "down"); }, get: async () => ({ data: {} }) } as unknown as NameResolverDeps["esi"] });
    await expect(h.resolver.resolveNames([34])).rejects.toMatchObject({ status: 503 });
  });
  it("never posts structure ids (>= 1e12); they resolve to unknown without a cached negative entry", async () => {
    const h = harness();
    const out = await h.resolver.resolveNames([34, 1035466617946]);
    expect(h.posts).toEqual([[34]]);
    expect(out.get(1035466617946)).toEqual({ name: null, category: "unknown" });
    expect(out.get(34)!.name).toBe("Tritanium");
    expect(h.names.has(1035466617946)).toBe(false);
  });
});

describe("resolveLocations", () => {
  it("routes each id by range", async () => {
    const h = harness();
    const out = await h.resolver.resolveLocations([30000142, 60003760, 1035466617946, 42], 1);
    expect(out.get(30000142)).toEqual({ kind: "system", name: "Jita", solarSystemId: 30000142 });
    expect(out.get(60003760)).toEqual({ kind: "station", name: KNOWN[60003760].name, solarSystemId: 30000142 });
    expect(out.get(1035466617946)).toEqual({ kind: "structure", name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144 });
    expect(out.get(42)).toEqual({ kind: "unknown", name: null, solarSystemId: null });
    expect(h.gets).toEqual(["/universe/structures/1035466617946"]);
  });
  it("stores forbidden = true on a 403 and stops asking", async () => {
    const h = harness({ esi: { post: async () => [], get: async () => { throw new EsiError(403, "/universe/structures/1", "Forbidden"); } } as unknown as NameResolverDeps["esi"] });
    const out = await h.resolver.resolveLocations([1035466617946], 1);
    expect(out.get(1035466617946)).toEqual({ kind: "structure", name: null, solarSystemId: null });
    expect(h.structures.get(1035466617946)!.forbidden).toBe(true);
  });
  it("stores forbidden = true on a 404 (deleted/moved structure) and does not throw", async () => {
    const h = harness({ esi: { post: async () => [], get: async () => { throw new EsiError(404, "/universe/structures/1", "Not found"); } } as unknown as NameResolverDeps["esi"] });
    const out = await h.resolver.resolveLocations([1035466617946], 1);
    expect(out.get(1035466617946)).toEqual({ kind: "structure", name: null, solarSystemId: null });
    expect(h.structures.get(1035466617946)!.forbidden).toBe(true);
  });
  it("lets a 5xx on the structure fetch propagate instead of caching forbidden", async () => {
    const h = harness({ esi: { post: async () => [], get: async () => { throw new EsiError(503, "/universe/structures/1", "down"); } } as unknown as NameResolverDeps["esi"] });
    await expect(h.resolver.resolveLocations([1035466617946], 1)).rejects.toMatchObject({ status: 503 });
    expect(h.structures.has(1035466617946)).toBe(false);
  });
  it("skips the structure call entirely when the token lacks the scope", async () => {
    const h = harness({ hasStructureScope: async () => false });
    const out = await h.resolver.resolveLocations([1035466617946], 1);
    expect(h.gets).toEqual([]);
    expect(out.get(1035466617946)).toEqual({ kind: "structure", name: null, solarSystemId: null });
  });
  it("reuses a structure row younger than 7 days and refreshes an older one", async () => {
    const cached = harness();
    cached.structures.set(1035466617946, { id: 1035466617946, name: "Old Tower", solarSystemId: 30000144, typeId: 35834, ownerId: 98599770, forbidden: false, updatedAt: new Date(NOW - STRUCTURE_TTL_MS + 1000) });
    expect((await cached.resolver.resolveLocations([1035466617946], 1)).get(1035466617946)!.name).toBe("Old Tower");
    expect(cached.gets).toEqual([]);
    const stale = harness();
    stale.structures.set(1035466617946, { id: 1035466617946, name: "Old Tower", solarSystemId: 30000144, typeId: 35834, ownerId: 98599770, forbidden: false, updatedAt: new Date(NOW - STRUCTURE_TTL_MS - 1000) });
    expect((await stale.resolver.resolveLocations([1035466617946], 1)).get(1035466617946)!.name).toBe("Perimeter - Tranquility Trading Tower");
    expect(stale.gets).toEqual(["/universe/structures/1035466617946"]);
  });
});
