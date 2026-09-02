/**
 * The browser's copy of the dogma data (spec §3). Module-level Maps, one store per tab, shared by
 * every editor on the page. No React here — this is plain promises and Maps so it can be tested
 * with a fake `fetch`.
 */
import {
  deserialiseMeta, deserialiseTypes, dogmaDataFrom,
  type DogmaData, type DogmaMeta, type DogmaMetaJson, type DogmaType, type DogmaTypesJson,
} from "../dogma/index.js";
import { MAX_IDS } from "../api/json.js";
import { FUZZWORK_CHUNK } from "../market/constants.js";
import type { Price } from "../view/price.js";

export interface SkillContext { skills: Map<number, number>; implants: number[]; synced: boolean }

/** The ceilings the two routes enforce (Tasks 6 and 8), re-exported under the store's own names. */
export const TYPE_CHUNK = MAX_IDS;
export const PRICE_CHUNK = FUZZWORK_CHUNK;
/** EVE's skill category. */
const SKILL_CATEGORY = 16;

let metaPromise: Promise<DogmaMeta> | null = null;
let meta: DogmaMeta | null = null;
let allVPromise: Promise<number[]> | null = null;
const types = new Map<number, DogmaType>();
const unknown = new Set<number>();

/** Drops everything. Used by the tests and when a types response reports a different SDE build. */
export function resetDogmaStore(): void {
  metaPromise = null;
  meta = null;
  allVPromise = null;
  types.clear();
  unknown.clear();
}

async function json<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return (await res.json()) as T;
}

/** The ~1.25 MB attribute/effect/group blob. Cached for a day by the browser, forever by this tab. */
export function getDogmaMeta(fetchImpl: typeof fetch = fetch): Promise<DogmaMeta> {
  metaPromise ??= json<DogmaMetaJson>("/api/dogma/meta", fetchImpl)
    .then((body) => { meta = deserialiseMeta(body); return meta; })
    .catch((e: unknown) => { metaPromise = null; throw e; });   // a failure must not poison the tab
  return metaPromise;
}

/** Loads any of these ids we do not already have (or already know the server does not have). */
export async function ensureTypes(ids: number[], fetchImpl: typeof fetch = fetch): Promise<void> {
  const wanted = [...new Set(ids)].filter((id) => !types.has(id) && !unknown.has(id));
  for (let i = 0; i < wanted.length; i += TYPE_CHUNK) {
    const batch = wanted.slice(i, i + TYPE_CHUNK);
    const body = await json<DogmaTypesJson>(
      `/api/dogma/types?ids=${encodeURIComponent(batch.join(","))}`, fetchImpl);
    if (meta !== null && body.build !== meta.build) {
      // The SDE was re-imported under us: every id we hold may be from the old build.
      resetDogmaStore();
      throw new Error("static data changed; reload");
    }
    for (const [id, type] of deserialiseTypes(body.types)) types.set(id, type);
    // Anything we asked for and did not get back does not exist in this build.
    for (const id of batch) if (!types.has(id)) unknown.add(id);
  }
}

/** Everything the store holds right now, as the engine wants it. */
export function dogmaData(): DogmaData {
  if (meta === null) throw new Error("dogma meta has not been loaded yet");
  return dogmaDataFrom(meta, types);
}

/**
 * Every skill type id in the game. All-V needs the *whole* list, not the fit's required-skill
 * closure: Advanced Weapon Upgrades (11207) cuts a turret's powergrid without being a required
 * skill of any turret, so the closure would leave it out and the numbers would be wrong.
 */
export function allVSkillIds(fetchImpl: typeof fetch = fetch): Promise<number[]> {
  allVPromise ??= json<{ types: { id: number }[] }>(
    `/api/sde/types?category=${SKILL_CATEGORY}&limit=1000`, fetchImpl)
    .then((body) => body.types.map((t) => t.id))
    .catch((e: unknown) => { allVPromise = null; throw e; });
  return allVPromise;
}

/** The skills half of the engine's `FitContext`, with the types those skills need already loaded. */
export async function skillContext(
  characterId: number | "all-v", fetchImpl: typeof fetch = fetch,
): Promise<SkillContext> {
  try {
    if (characterId === "all-v") {
      const ids = await allVSkillIds(fetchImpl);
      await ensureTypes(ids, fetchImpl);
      return { skills: new Map(ids.map((id) => [id, 5])), implants: [], synced: true };
    }
    const body = await json<{ skills: { skillId: number; level: number }[]; implants: number[] }>(
      `/api/characters/${characterId}/skills`, fetchImpl);
    await ensureTypes([...body.skills.map((s) => s.skillId), ...body.implants], fetchImpl);
    return {
      skills: new Map(body.skills.map((s) => [s.skillId, s.level])),
      implants: body.implants,
      synced: body.skills.length > 0,
    };
  } catch (e) {
    // A network blip must not blank the editor: fall back to "nothing trained", which is exactly
    // what /ships does when phase 3 has not synced, and let the banner say so.
    console.error("[fitting] could not load the skill context", e);
    return { skills: new Map(), implants: [], synced: false };
  }
}

/** Jita prices for the fit and the visible browser page, in chunks the route accepts. */
export async function pricesFor(
  ids: number[], fetchImpl: typeof fetch = fetch,
): Promise<Map<number, Price>> {
  const wanted = [...new Set(ids)];
  const out = new Map<number, Price>();
  for (let i = 0; i < wanted.length; i += PRICE_CHUNK) {
    const batch = wanted.slice(i, i + PRICE_CHUNK);
    const body = await json<{ prices: Record<string, Price> }>(
      `/api/market/prices?ids=${encodeURIComponent(batch.join(","))}`, fetchImpl);
    for (const [id, price] of Object.entries(body.prices)) out.set(Number(id), price);
  }
  return out;
}
