import { hasScope } from "../auth/sso.js";
import { getCharacter } from "../db/characters.js";
import { getNames, putNames, getStructures, putStructure } from "../db/names.js";
import { createEsiClient } from "../esi/index.js";
import { getSolarSystem, getStation } from "../sde/repo.js";
import { createNameResolver, type NameResolver, type ResolvedLocation, type ResolvedName } from "./resolve.js";

let resolver: NameResolver | undefined;

/** The real resolver, wired to Postgres and the shared ESI client. Memoised like createEsiClient. */
export function nameResolver(): NameResolver {
  return (resolver ??= createNameResolver({
    esi: createEsiClient(),
    getNames, putNames, getStructures, putStructure,
    getSolarSystem: (id) => getSolarSystem(id),
    getStation: (id) => getStation(id),
    hasStructureScope: async (characterId) => hasScope(await getCharacter(characterId), "esi-universe.read_structures.v1"),
  }));
}

export function resolveNames(ids: number[]): Promise<Map<number, ResolvedName>> {
  return nameResolver().resolveNames(ids);
}
export function resolveLocations(locationIds: number[], characterId: number): Promise<Map<number, ResolvedLocation>> {
  return nameResolver().resolveLocations(locationIds, characterId);
}

export { locationLabel, type LocationLabel } from "./label.js";
export { classifyLocation, unknownStructureLabel, type LocationKind } from "./ranges.js";
export type { NameResolver, ResolvedName, ResolvedLocation } from "./resolve.js";
