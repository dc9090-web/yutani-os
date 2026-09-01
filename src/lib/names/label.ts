import { getNames, getStructures } from "../db/names.js";
import { getSolarSystems, getStations } from "../sde/repo.js";
import { classifyLocation, unknownStructureLabel, type LocationKind } from "./ranges.js";

export interface LocationLabel { name: string; solarSystemId: number | null; kind: LocationKind }

/** Positive integers only: 0 and negatives are never real ESI ids and must not reach a query. */
function usable(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

/**
 * Read-only helper for pages: Postgres only, never ESI, and exactly four queries however many ids
 * arrive. Degrades to a readable placeholder instead of throwing (spec §9).
 *
 * Caller contract: only pass ids that really are locations. Asset `item_id`s live in the same
 * >= 1e12 range as player structures, so a nested asset row's `location_id` passed in here would
 * come back as "Unknown structure (…)" — see `buildAssetTree`'s `locationType`.
 */
export async function locationLabels(ids: number[]): Promise<Map<number, LocationLabel>> {
  const out = new Map<number, LocationLabel>();
  const wanted = usable(ids);
  if (wanted.length === 0) return out;

  const systemIds = wanted.filter((id) => classifyLocation(id) === "system");
  const stationIds = wanted.filter((id) => classifyLocation(id) === "station");
  const structureIds = wanted.filter((id) => classifyLocation(id) === "structure");

  const [systems, stations, named, structures] = await Promise.all([
    getSolarSystems(systemIds),
    getStations(stationIds),
    getNames(stationIds),          // NPC station names live in universe_names, not in the SDE
    getStructures(structureIds),
  ]);
  const nameById = new Map(named.map((n) => [n.id, n.name]));
  const structureById = new Map(structures.map((s) => [s.id, s]));

  for (const id of wanted) {
    switch (classifyLocation(id)) {
      case "system": {
        const system = systems.get(id);
        out.set(id, { name: system?.name ?? `Unknown system (${id})`, solarSystemId: id, kind: "system" });
        break;
      }
      case "station": {
        out.set(id, {
          name: nameById.get(id) ?? `Unknown station (${id})`,
          solarSystemId: stations.get(id)?.solarSystemId ?? null,
          kind: "station",
        });
        break;
      }
      case "structure": {
        const structure = structureById.get(id);
        const name = structure && !structure.forbidden && structure.name ? structure.name : unknownStructureLabel(id);
        out.set(id, { name, solarSystemId: structure?.solarSystemId ?? null, kind: "structure" });
        break;
      }
      default:
        out.set(id, { name: `Unknown location (${id})`, solarSystemId: null, kind: "unknown" });
    }
  }
  return out;
}

/** The single-id form phase 3a defined; one implementation, so the two can never disagree. */
export async function locationLabel(id: number): Promise<LocationLabel> {
  const labels = await locationLabels([id]);
  return labels.get(id) ?? { name: `Unknown location (${id})`, solarSystemId: null, kind: "unknown" };
}

/**
 * id -> name for anything the sync jobs cached in `universe_names` (wallet parties, station names).
 * Postgres only: the wallet job already ran `resolveNames` over every party id, so a miss here means
 * "not synced yet", not "ask ESI".
 */
export async function displayNames(ids: number[]): Promise<Map<number, string>> {
  const wanted = usable(ids);
  const out = new Map<number, string>();
  if (wanted.length === 0) return out;
  for (const row of await getNames(wanted)) {
    if (row.name !== null) out.set(row.id, row.name);
  }
  return out;
}
