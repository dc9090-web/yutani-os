import { getPrices } from "../db/market-prices.js";
import { getTypeBonuses, getTypes } from "../sde/repo.js";
import { locationLabels } from "../names/index.js";
import { CATEGORY, fitFromAssets, fitFromFitting, fitPerformance, type BuiltFit } from "../dogma/index.js";
import { buildFitSheet, typeDescription, type FitSheetView } from "../view/fit-sheet.js";
import {
  SAVED_FIT_LOCATION, assembledShips, computeFit, fitValueEntries, shipLocationLabel,
} from "../view/ships.js";
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
  data: FitData; key: string; title: string; subtitle: string; typeId: number; typeName: string;
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
  const bonusTypes = await getTypes(bonusSkillIds);

  const skillNames = new Map<number, string>();
  for (const type of input.data.ctx.data.types.values()) {
    if (type.categoryId === CATEGORY.skill && type.name !== null) skillNames.set(type.id, type.name);
  }
  for (const [id, type] of bonusTypes) if (type.name !== null) skillNames.set(id, type.name);

  return {
    kind: "ok",
    view: buildFitSheet({
      title: input.title, subtitle: input.subtitle, typeId: input.typeId, typeName: input.typeName,
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

  const places = await locationLabels(
    group.ship.locationType === "item" ? [] : [group.ship.locationId]);
  const byItemId = new Map(data.assets.map((a) => [a.itemId, a]));
  const typeName = data.ctx.data.types.get(group.ship.typeId)?.name ?? `Unknown type (${group.ship.typeId})`;

  return sheetFor({
    data, key: `asset:${itemId}`,
    title: group.ship.name ?? typeName,
    subtitle: shipLocationLabel(group.ship, places, byItemId, data.ctx.data),
    typeId: group.ship.typeId, typeName,
    build: () => fitFromAssets(group.ship, group.children, data.ctx),
  });
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
    subtitle: SAVED_FIT_LOCATION,
    typeId: fitting.shipTypeId, typeName,
    build: () => fitFromFitting(fitting, fitting.items, data.ctx),
  });
}
