import { getClones, listImplants } from "../db/character-clones.js";
import { getTypeAttributes, getTypes } from "../sde/repo.js";
import { placeViews, type PlaceView } from "../names/place.js";
import { cloneLocations, cloneView, type CloneLocationView, type ClonePlace, type CloneView, type ImplantSource } from "../view/clones.js";
import { typeDescription } from "../view/format.js";
import { iso } from "./raw.js";

export interface ClonesData {
  /** False until the clones job has written anything for this character. */
  synced: boolean;
  home: PlaceView | null;
  active: CloneView;
  locations: CloneLocationView[];
  /**
   * When the character last jumped clones, ISO-8601 UTC. The page shows no cooldown; this is here so
   * a reader that wants one works it out from the time itself rather than from a string that ages.
   */
  lastCloneJumpAt: string | null;
}

/** Clones: the active clone's implants, the home station, and jump clones grouped by where they are. */
export async function loadClones(characterId: number): Promise<ClonesData> {
  const [implantIds, clones] = await Promise.all([
    listImplants(characterId),
    getClones(characterId),
  ]);
  const jumpClones = clones?.jumpClones ?? [];

  // One types query for every implant on the page, one dogma query per distinct implant type (the
  // slot and the attribute bonus both live there), and one locationLabels pass for the home station
  // plus every jump clone.
  const typeIds = [...new Set([...implantIds, ...jumpClones.flatMap((c) => c.implants)])];
  const [types, attributes, places] = await Promise.all([
    getTypes(typeIds),
    Promise.all(typeIds.map((id) => getTypeAttributes(id))),
    placeViews([
      ...(clones?.homeLocationId == null ? [] : [clones.homeLocationId]),
      ...jumpClones.map((c) => c.locationId).filter((id): id is number => id !== null),
    ]),
  ]);

  const implantTypes = new Map<number, ImplantSource>(typeIds.map((id, index) => [id, {
    name: types.get(id)?.name ?? null,
    attributes: attributes[index],
    desc: typeDescription(types.get(id)?.description),
  }]));
  const clonePlaces = new Map<number, ClonePlace>([...places].map(([id, place]) => [id, {
    name: place.name,
    // A clone parked in a system-level place has nothing more specific than the system itself.
    systemName: place.kind === "system" ? null : place.system?.name ?? null,
    system: place.system,
  }]));

  return {
    synced: clones !== null || implantIds.length > 0,
    home: clones?.homeLocationId == null ? null : places.get(clones.homeLocationId) ?? null,
    active: cloneView(implantIds, implantTypes),
    locations: cloneLocations(jumpClones, clonePlaces, implantTypes),
    lastCloneJumpAt: iso(clones?.lastCloneJumpDate ?? null),
  };
}
