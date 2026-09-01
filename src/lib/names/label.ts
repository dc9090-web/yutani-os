import { getName, getStructure } from "../db/names.js";
import { getSolarSystem, getStation } from "../sde/repo.js";
import { classifyLocation, unknownStructureLabel, type LocationKind } from "./ranges.js";

export interface LocationLabel { name: string; solarSystemId: number | null; kind: LocationKind }

/** Read-only helper for pages: Postgres only, never ESI. Degrades instead of throwing. */
export async function locationLabel(id: number): Promise<LocationLabel> {
  switch (classifyLocation(id)) {
    case "system": {
      const system = await getSolarSystem(id);
      return { name: system?.name ?? `Unknown system (${id})`, solarSystemId: id, kind: "system" };
    }
    case "station": {
      const [named, station] = await Promise.all([getName(id), getStation(id)]);
      return { name: named?.name ?? `Unknown station (${id})`, solarSystemId: station?.solarSystemId ?? null, kind: "station" };
    }
    case "structure": {
      const structure = await getStructure(id);
      const name = structure && !structure.forbidden && structure.name ? structure.name : unknownStructureLabel(id);
      return { name, solarSystemId: structure?.solarSystemId ?? null, kind: "structure" };
    }
    default:
      return { name: `Unknown location (${id})`, solarSystemId: null, kind: "unknown" };
  }
}
