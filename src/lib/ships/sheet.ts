import { getPrices } from "../db/market-prices.js";
import { getRaces, getSolarSystems, getTypeBonuses, getTypes } from "../sde/repo.js";
import { locationLabels } from "../names/index.js";
import { CATEGORY, fitFromAssets, fitFromFitting, fitPerformance, type BuiltFit } from "../dogma/index.js";
import { buildFitSheet, typeDescription, type FitSheetView, type SheetLocationView } from "../view/fit-sheet.js";
import { SAVED_FIT_LOCATION, assembledShips, computeFit, fitValueEntries } from "../view/ships.js";
import { secClass, secText } from "../view/format.js";
import type { AssetRow } from "../db/character-assets.js";
import { loadFitData, type FitData } from "./load.js";

export type SheetResult =
  | { kind: "ok"; view: FitSheetView }
  | { kind: "notFound" }
  | { kind: "error"; title: string };

/**
 * The half both routes share: run the engine once, price everything on the sheet in one query, read
 * the hull's bonuses, and name the bonus skills with one `getTypes`. Every other name on the page
 * already lives in `DogmaData`.
 */
async function sheetFor(input: {
  data: FitData; key: string; title: string; typeId: number; typeName: string; location: SheetLocationView;
  build: () => BuiltFit;
}): Promise<SheetResult> {
  const computed = computeFit(input.build, input.key);
  if (computed === null) return { kind: "error", title: input.title };
  const { built, stats, problems } = computed;

  const priceIds = [
    ...fitValueEntries(built).map((e) => e.typeId),
    ...built.unfittable.map((e) => e.typeId),
    ...built.unknown.map((e) => e.typeId),
  ];
  // The same id set prices everything and describes everything: one `getTypes` over it is the
  // hover text for every module, charge, drone and cargo line on the sheet.
  const [prices, bonuses, itemTypes] = await Promise.all([
    getPrices(priceIds), getTypeBonuses(input.typeId), getTypes([...new Set(priceIds)]),
  ]);
  const descriptions = new Map<number, string>();
  for (const [id, type] of itemTypes) {
    const desc = typeDescription(type.description);
    if (desc !== null) descriptions.set(id, desc);
  }
  const bonusSkillIds = [...new Set(bonuses.map((b) => b.skillTypeId).filter((id): id is number => id !== null))];
  // The hull's own row rides along for its race (DogmaData carries no race); the group is in DogmaData.
  const [bonusTypes, races] = await Promise.all([getTypes([...bonusSkillIds, input.typeId]), getRaces()]);
  const hullType = bonusTypes.get(input.typeId);
  const hullGroupId = input.data.ctx.data.types.get(input.typeId)?.groupId;
  const ship = {
    typeName: input.typeName,
    groupName: hullGroupId === undefined ? null : input.data.ctx.data.groups.get(hullGroupId)?.name ?? null,
    raceName: hullType?.raceId == null ? null : races.get(hullType.raceId) ?? null,
  };

  const skillNames = new Map<number, string>();
  for (const type of input.data.ctx.data.types.values()) {
    if (type.categoryId === CATEGORY.skill && type.name !== null) skillNames.set(type.id, type.name);
  }
  for (const [id, type] of bonusTypes) if (type.name !== null) skillNames.set(id, type.name);

  return {
    kind: "ok",
    view: buildFitSheet({
      title: input.title, typeId: input.typeId, typeName: input.typeName, ship, location: input.location,
      built, stats, problems, bonuses,
      skillLevels: input.data.ctx.skills, skillNames, prices, descriptions, perf: fitPerformance(built.fit),
      skillsSynced: input.data.skillsSynced,
    }),
  };
}

/** `/ships/asset/[itemId]` — an assembled ship in the character's assets. */
export async function assetSheet(characterId: number, itemId: number): Promise<SheetResult> {
  const data = await loadFitData(characterId);
  const group = assembledShips(data.assets, data.ctx.data).find((g) => g.ship.itemId === itemId);
  if (group === undefined) return { kind: "notFound" };

  const byItemId = new Map(data.assets.map((a) => [a.itemId, a]));
  const typeName = data.ctx.data.types.get(group.ship.typeId)?.name ?? `Unknown type (${group.ship.typeId})`;

  return sheetFor({
    data, key: `asset:${itemId}`,
    title: group.ship.name ?? typeName,
    location: await shipLocation(group.ship, byItemId, data),
    typeId: group.ship.typeId, typeName,
    build: () => fitFromAssets(group.ship, group.children, data.ctx),
  });
}

/**
 * The header's location: climb out of any containers the ship sits in (a ship maintenance bay, a
 * can) to the real place, name it, and colour its system's security. Container names become the
 * note, outermost last — "in Small Standard Container".
 */
async function shipLocation(ship: AssetRow, byItemId: ReadonlyMap<number, AssetRow>, data: FitData): Promise<SheetLocationView> {
  const containers: string[] = [];
  let holder: AssetRow = ship;
  while (holder.locationType === "item") {
    const parent = byItemId.get(holder.locationId);
    if (parent === undefined) return { system: null, place: `Container ${holder.locationId}`, note: null };
    containers.push(parent.name ?? data.ctx.data.types.get(parent.typeId)?.name ?? `Container ${parent.itemId}`);
    holder = parent;
  }
  const label = (await locationLabels([holder.locationId])).get(holder.locationId);
  const note = containers.length === 0 ? null : `in ${containers.join(" · ")}`;
  if (label === undefined) return { system: null, place: `Unknown location (${holder.locationId})`, note };
  const solar = label.solarSystemId === null ? null : (await getSolarSystems([label.solarSystemId])).get(label.solarSystemId) ?? null;
  const systemName = label.kind === "system" ? label.name : solar?.name ?? null;
  return {
    system: systemName === null ? null : { name: systemName, sec: secText(solar?.securityStatus ?? null), secClass: secClass(solar?.securityStatus ?? null) },
    place: label.kind === "system" ? null : label.name,
    note,
  };
}

/** `/ships/fit/[fittingId]` — a saved ESI fitting. */
export async function fittingSheet(characterId: number, fittingId: number): Promise<SheetResult> {
  const data = await loadFitData(characterId);
  const fitting = data.fittings.find((f) => f.fittingId === fittingId);
  if (fitting === undefined) return { kind: "notFound" };
  const typeName = data.ctx.data.types.get(fitting.shipTypeId)?.name ?? `Unknown type (${fitting.shipTypeId})`;

  return sheetFor({
    data, key: `fit:${fittingId}`,
    title: fitting.name,
    // Deliberately not the description: it is player-authored HTML from the EVE client.
    location: { system: null, place: null, note: SAVED_FIT_LOCATION },
    typeId: fitting.shipTypeId, typeName,
    build: () => fitFromFitting(fitting, fitting.items, data.ctx),
  });
}
