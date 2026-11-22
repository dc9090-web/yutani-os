import { listAssets } from "../db/character-assets.js";
import { getGroups, getTypes } from "../sde/repo.js";
import { placeViews } from "../names/place.js";
import { typeDescription } from "../view/format.js";
import { buildAssetTree, isBlueprintCategory, isChargeCategory, locationDisplayLabel, sumVolume, toViewNodes, type AssetViewLocation, type TypeInfo } from "../view/assets.js";

export interface AssetsData {
  /** Asset rows the character owns, containers and their contents alike. */
  itemCount: number;
  /** Most items first, so the first one is the "largest location". */
  locations: AssetViewLocation[];
  /** typeId → hover text, once per type rather than per item. */
  descriptions: Record<number, string>;
}

/** Assets: the whole tree by location. Searching and grouping happen in the reader. */
export async function loadAssets(characterId: number): Promise<AssetsData> {
  // One query for the character's assets (spec §7), one for every type on the page, one for the
  // location names.
  const rows = await listAssets(characterId);
  const tree = buildAssetTree(rows);
  const [types, places] = await Promise.all([
    getTypes([...new Set(rows.map((r) => r.typeId))]),
    // Every root, including "item"-typed ones: those are orphans (a structure-docked hangar), so
    // they are places too — see locationDisplayLabel and AssetLocation's doc comment.
    placeViews(tree.map((l) => l.locationId)),
  ]);

  // Blueprints have no "icon" image, only bp/bpc, and a loaded charge shares its module's slot —
  // both facts live on the group's category, so one more small batch over the groups on the page.
  const groups = await getGroups([...new Set([...types.values()].flatMap((t) => (t.groupId === null ? [] : [t.groupId])))]);
  const typeInfo = new Map<number, TypeInfo>();
  for (const [id, type] of types) {
    const categoryId = type.groupId === null ? null : groups.get(type.groupId)?.categoryId ?? null;
    typeInfo.set(id, { name: type.name, volume: type.volume, isBlueprint: isBlueprintCategory(categoryId), isCharge: isChargeCategory(categoryId) });
  }

  // Hover text, once per type rather than per item: a hangar of 800 rows is ~200 types.
  const descriptions: Record<number, string> = {};
  for (const [id, type] of types) {
    const desc = typeDescription(type.description);
    if (desc !== null) descriptions[id] = desc;
  }

  const locations: AssetViewLocation[] = tree.map((location) => {
    const nodes = toViewNodes(location.nodes, typeInfo);
    return {
      locationId: location.locationId,
      label: locationDisplayLabel(location.locationId, places.get(location.locationId)),
      system: places.get(location.locationId)?.system ?? null,
      itemCount: location.itemCount,
      volume: sumVolume(nodes),
      nodes,
    };
  });
  return { itemCount: rows.length, locations, descriptions };
}
