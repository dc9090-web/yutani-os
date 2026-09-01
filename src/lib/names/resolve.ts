import { EsiError } from "../esi/client.js";
import { chunk } from "../chunk.js";
import { classifyLocation, type LocationKind } from "./ranges.js";
import type { StructureInput, StructureRow, UniverseName } from "../db/names.js";

export interface ResolvedName { name: string | null; category: string }
export interface ResolvedLocation { kind: LocationKind; name: string | null; solarSystemId: number | null }
interface EsiName { id: number; name: string; category: string }
interface EsiStructure { name: string; owner_id: number; solar_system_id: number; type_id?: number }

export const NAMES_CHUNK = 1000;                          // POST /universe/names maxItems
export const UNKNOWN_TTL_MS = 7 * 24 * 60 * 60 * 1000;    // negative cache for unresolvable ids
export const VOLATILE_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // character/corporation/alliance names
export const STRUCTURE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const UNKNOWN_CATEGORY = "unknown";
export const VOLATILE_CATEGORIES = new Set(["character", "corporation", "alliance"]);

export interface NameResolverDeps {
  esi: {
    post<T>(path: string, body: unknown, opts?: { characterId?: number }): Promise<T>;
    get<T>(path: string, opts?: { characterId?: number }): Promise<{ data: T }>;
  };
  getNames: (ids: number[]) => Promise<UniverseName[]>;
  putNames: (rows: { id: number; category: string; name: string | null }[]) => Promise<number>;
  getStructures: (ids: number[]) => Promise<StructureRow[]>;
  putStructure: (row: StructureInput) => Promise<void>;
  getSolarSystem: (id: number) => Promise<{ id: number; name: string | null } | null>;
  getStation: (id: number) => Promise<{ id: number; solarSystemId: number | null } | null>;
  hasStructureScope: (characterId: number) => Promise<boolean>;
  now?: () => number;
}

export interface NameResolver {
  resolveNames(ids: number[]): Promise<Map<number, ResolvedName>>;
  resolveLocations(locationIds: number[], characterId: number): Promise<Map<number, ResolvedLocation>>;
}

export function createNameResolver(deps: NameResolverDeps): NameResolver {
  const now = deps.now ?? Date.now;
  const usable = (ids: number[]): number[] => [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];

  /** Types, regions, stations and systems never change; people and organisations rename. */
  function isFresh(row: UniverseName, at: number): boolean {
    const age = at - row.updatedAt.getTime();
    if (row.category === UNKNOWN_CATEGORY) return age < UNKNOWN_TTL_MS;
    if (VOLATILE_CATEGORIES.has(row.category)) return age < VOLATILE_TTL_MS;
    return true;
  }

  /**
   * POST /universe/names 404s the whole batch when *any* id is unresolvable, so a 404 is bisected
   * down to single ids: the good ones still resolve and the bad ones are identified exactly.
   */
  async function fetchNames(ids: number[]): Promise<EsiName[]> {
    if (ids.length === 0) return [];
    try {
      return await deps.esi.post<EsiName[]>("/universe/names", ids);
    } catch (e) {
      if (!(e instanceof EsiError) || e.status !== 404) throw e;
      if (ids.length === 1) return [];
      const mid = Math.floor(ids.length / 2);
      const head = await fetchNames(ids.slice(0, mid));
      const tail = await fetchNames(ids.slice(mid));
      return [...head, ...tail];
    }
  }

  async function resolveNames(ids: number[]): Promise<Map<number, ResolvedName>> {
    const wanted = usable(ids);
    const out = new Map<number, ResolvedName>();
    if (wanted.length === 0) return out;

    // Structure ids (>= 1e12) 404 the whole POST /universe/names batch and can never resolve
    // there; they are named via /universe/structures/{id} instead, so skip them entirely here
    // rather than caching a negative entry that would just get bisected out every time.
    const postable = wanted.filter((id) => id < 1e12);
    for (const id of wanted) if (id >= 1e12) out.set(id, { name: null, category: UNKNOWN_CATEGORY });
    if (postable.length === 0) return out;

    const at = now();
    for (const row of await deps.getNames(postable)) {
      if (isFresh(row, at)) out.set(row.id, { name: row.name, category: row.category });
    }
    for (const batch of chunk(postable.filter((id) => !out.has(id)), NAMES_CHUNK)) {
      const resolved = await fetchNames(batch);
      const seen = new Set(resolved.map((r) => r.id));
      const rows = [
        ...resolved.map((r) => ({ id: r.id, category: r.category, name: r.name as string | null })),
        // Anything ESI would not resolve is cached as 'unknown' so it is not retried every run.
        ...batch.filter((id) => !seen.has(id)).map((id) => ({ id, category: UNKNOWN_CATEGORY, name: null })),
      ];
      await deps.putNames(rows);
      for (const r of rows) out.set(r.id, { name: r.name, category: r.category });
    }
    return out;
  }

  /**
   * A 4xx (other than 401) means this id will never resolve for this character: 403 is an ACL
   * miss, 404 is a structure that was deleted or moved out of range. Remember that and stop
   * asking. A 401 means the token itself was rejected — not this id's problem — so it must
   * propagate for the scheduler's markNeedsReauth path to fire, same as a 5xx (including
   * EsiUnavailableError, a 503) or a non-ESI error, all of which are transient or unrelated to
   * this specific id and get the run retried instead of caching a false negative.
   */
  async function fetchStructure(id: number, characterId: number, at: number): Promise<StructureRow> {
    let row: StructureInput;
    try {
      const { data } = await deps.esi.get<EsiStructure>(`/universe/structures/${id}`, { characterId });
      row = { id, name: data.name, solarSystemId: data.solar_system_id, typeId: data.type_id ?? null, ownerId: data.owner_id, forbidden: false };
    } catch (e) {
      if (e instanceof EsiError && e.status >= 400 && e.status < 500 && e.status !== 401) {
        row = { id, name: null, solarSystemId: null, typeId: null, ownerId: null, forbidden: true };
      } else {
        throw e;
      }
    }
    await deps.putStructure(row);
    return { ...row, updatedAt: new Date(at) };
  }

  async function resolveLocations(locationIds: number[], characterId: number): Promise<Map<number, ResolvedLocation>> {
    const ids = usable(locationIds);
    const out = new Map<number, ResolvedLocation>();
    if (ids.length === 0) return out;
    const at = now();

    const stationIds = ids.filter((id) => classifyLocation(id) === "station");
    const stationNames = await resolveNames(stationIds);
    const structureIds = ids.filter((id) => classifyLocation(id) === "structure");
    const stored = new Map((await deps.getStructures(structureIds)).map((s) => [s.id, s]));
    const canReadStructures = structureIds.length > 0 && (await deps.hasStructureScope(characterId));

    for (const id of ids) {
      switch (classifyLocation(id)) {
        case "system": {
          const system = await deps.getSolarSystem(id);
          out.set(id, { kind: "system", name: system?.name ?? null, solarSystemId: id });
          break;
        }
        case "station": {
          const station = await deps.getStation(id);
          out.set(id, { kind: "station", name: stationNames.get(id)?.name ?? null, solarSystemId: station?.solarSystemId ?? null });
          break;
        }
        case "structure": {
          let row = stored.get(id) ?? null;
          if (canReadStructures && (row === null || at - row.updatedAt.getTime() > STRUCTURE_TTL_MS)) {
            row = await fetchStructure(id, characterId, at);
          }
          const name = row && !row.forbidden ? row.name : null;
          out.set(id, { kind: "structure", name: name ?? null, solarSystemId: row?.solarSystemId ?? null });
          break;
        }
        default:
          out.set(id, { kind: "unknown", name: null, solarSystemId: null });
      }
    }
    return out;
  }

  return { resolveNames, resolveLocations };
}
