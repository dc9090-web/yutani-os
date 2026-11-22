import { getConfig } from "../../config.js";
import { listCharacters } from "../../db/characters.js";
import { loadFitData, type FitData } from "../../ships/load.js";
import type { ShipsData } from "../../pages/ships.js";
import {
  assetsResource, charactersResource, clonesResource, meResource, overviewResource, serverResource, shipDetailResource, shipsResource,
  skillsResource, trainingOverviewResource, trainingResource, walletRowsResource, walletSummaryResource, type ShipDetailKind,
} from "./resources.js";
import { API_VERSION, ETAG_NOW, etagOf, type Resource } from "./respond.js";
import { inputStamps } from "./stamps.js";

export interface SyncEntry { path: string; etag: string }
export interface SyncData { resources: SyncEntry[] }

/**
 * What the sync list remembers between calls: per resource, the stamp of its inputs and the tag it
 * had under that stamp. Tags only — a few hundred short strings — never bodies: the site has 3 GB.
 * In memory, so a restart (every deploy) starts empty and the first sync after it rebuilds.
 */
interface Kept { stamp: string; etag: string; details?: string[] }
const kept = new Map<string, Kept>();

/** Test-only: forget every kept tag. */
export function resetSyncCache(): void { kept.clear(); }

/**
 * The part of a stamp that is not in the database: the API version and the settings the views read.
 * A new build needs no entry of its own while the tags live in memory — a deploy restarts the
 * process and starts empty. Moved to a table, they would need the build id in here.
 */
function version(): string {
  const config = getConfig();
  return [API_VERSION, [...config.overviewCharacterIds].sort().join(","), config.ownerInitials ?? ""].join("|");
}

/** The resource's current tag: the kept one while its stamp stands, otherwise built and kept. */
async function tagFor(resource: Resource, stamp: string, seen: Set<string>, onBuild?: (data: unknown) => string[]): Promise<Kept> {
  seen.add(resource.path);
  const hit = kept.get(resource.path);
  if (hit !== undefined && hit.stamp === stamp) return hit;
  // Built against ETAG_NOW, exactly as the resource's own GET tags itself, so the two always agree.
  const data = await resource.build(ETAG_NOW);
  const entry: Kept = { stamp, etag: etagOf(data), details: onBuild?.(data) };
  kept.set(resource.path, entry);
  return entry;
}

/** "asset:123" / "fit:7" — the keys of the Ships cards — as the detail resources they link to. */
function detailKeys(data: unknown): string[] {
  const ships = data as ShipsData;
  return [...ships.ships, ...ships.fits].map((card) => card.key);
}

async function build(): Promise<SyncEntry[]> {
  // Stamps first, tags after: a write that lands in between leaves a fresh tag under an old stamp,
  // which the next call rebuilds. The other order could keep a stale tag under a fresh stamp.
  const stamps = await inputStamps(version());
  const characters = await listCharacters();
  const seen = new Set<string>();
  const out: SyncEntry[] = [];
  const add = async (resource: Resource, stamp: string): Promise<void> => {
    out.push({ path: resource.path, etag: (await tagFor(resource, stamp, seen)).etag });
  };

  await add(charactersResource(), stamps.ofAll("skills"));
  await add(overviewResource(), stamps.ofAll("skills", "wallet", "location"));
  await add(trainingOverviewResource(), stamps.ofAll("skills", "location"));

  // One character at a time: a cold start runs the fitting engine for every ship, and doing that
  // for every character at once would hold all their fit data in memory together.
  for (const { id } of characters) {
    await add(skillsResource(id), stamps.of(id, "skills"));
    await add(trainingResource(id), stamps.of(id, "skills"));
    await add(clonesResource(id), stamps.of(id, "clones"));
    await add(assetsResource(id), stamps.of(id, "assets"));
    await add(walletSummaryResource(id), stamps.of(id, "wallet"));
    await add(walletRowsResource(id, "journal"), stamps.of(id, "wallet"));
    await add(walletRowsResource(id, "transactions"), stamps.of(id, "wallet"));

    // Everything a fit is computed from: the ship and its modules, saved fits, the pilot's skills
    // and implants, and the prices its value is summed from.
    const shipStamp = stamps.of(id, "assets", "fittings", "skills", "clones", "prices");
    let data: Promise<FitData> | undefined;
    const fitData = (): Promise<FitData> => (data ??= loadFitData(id));
    const ships = shipsResource(id, fitData);
    const list = await tagFor(ships, shipStamp, seen, detailKeys);
    out.push({ path: ships.path, etag: list.etag });
    for (const key of list.details ?? []) {
      const [kind, detailId] = key.split(":");
      await add(shipDetailResource(id, kind as ShipDetailKind, Number(detailId), fitData), shipStamp);
    }
  }

  // A character removed, a ship sold: its tag has no further use.
  for (const path of kept.keys()) if (!seen.has(path)) kept.delete(path);
  return out;
}

let running: Promise<SyncEntry[]> | undefined;

/**
 * Everything a phone should hold, with each resource's current ETag. Cheap when nothing changed:
 * a couple of dozen digest queries and no loader runs. Two phones (or one retry) asking during a
 * cold build share that one build.
 */
export async function loadSync(who: { email: string }): Promise<SyncData> {
  running ??= build().finally(() => { running = undefined; });
  const shared = await running;
  // Two one-row resources, tagged on the spot: cheaper to build than to stamp.
  const small = await Promise.all([meResource(who), serverResource()].map(async (r) => ({ path: r.path, etag: etagOf(await r.build(ETAG_NOW)) })));
  return { resources: [...small, ...shared] };
}

export const syncResource = (who: { email: string }): Resource<SyncData> => ({
  path: "/api/v1/sync", clock: false,
  build: () => loadSync(who),
});
