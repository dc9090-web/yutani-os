/**
 * Everything `/fitting` shows, in one `loadDogmaData` call. Server only.
 *
 * No engine maths happens here: a fit's value is the sum of its items' prices, and the static data
 * is needed only for type names and for `assembledShips`'s category check.
 */
import { listAssets } from "../db/character-assets.js";
import { listFittings } from "../db/character-fittings.js";
import { listCharacters } from "../db/characters.js";
import { listFits } from "../db/fits.js";
import { getPrices } from "../db/market-prices.js";
import { loadDogmaData } from "../dogma/sde-loader.js";
import { relativeTime } from "../view/format.js";
import { iskShort, rollUpValue, unpricedNote, type ValuedEntry } from "../view/price.js";
import { assembledShips } from "../view/ships.js";

export interface FitListRow {
  id: number; name: string; typeName: string; pilot: string;
  updated: string; value: string; unpriced: string | null;
}
export interface CloneSource { id: number; label: string }
export interface FittingIndex { rows: FitListRow[]; fittings: CloneSource[]; ships: CloneSource[] }

export const ALL_V_PILOT = "All skills V";

export async function loadFittingIndex(
  characterId: number | null, now: Date = new Date(),
): Promise<FittingIndex> {
  const [fits, characters, assets, fittings] = await Promise.all([
    listFits(),
    listCharacters(),
    characterId === null ? Promise.resolve([]) : listAssets(characterId),
    characterId === null ? Promise.resolve([]) : listFittings(characterId),
  ]);

  const typeIds = new Set<number>();
  for (const fit of fits) {
    typeIds.add(fit.shipTypeId);
    for (const item of fit.items) {
      typeIds.add(item.typeId);
      if (item.chargeTypeId !== null) typeIds.add(item.chargeTypeId);
    }
  }
  for (const asset of assets) typeIds.add(asset.typeId);
  for (const fitting of fittings) typeIds.add(fitting.shipTypeId);

  const data = await loadDogmaData([...typeIds]);
  const prices = await getPrices([...typeIds]);
  const names = new Map(characters.map((c) => [c.id, c.name]));
  const typeName = (id: number) => data.types.get(id)?.name ?? `Unknown type (${id})`;

  const rows: FitListRow[] = fits.map((fit) => {
    const entries: ValuedEntry[] = [{ typeId: fit.shipTypeId, quantity: 1 }];
    for (const item of fit.items) {
      entries.push({ typeId: item.typeId, quantity: item.quantity });
      if (item.chargeTypeId !== null) entries.push({ typeId: item.chargeTypeId, quantity: 1 });
    }
    const roll = rollUpValue(entries, prices);
    return {
      id: fit.id, name: fit.name, typeName: typeName(fit.shipTypeId),
      pilot: fit.characterId === null ? ALL_V_PILOT : (names.get(fit.characterId) ?? ALL_V_PILOT),
      updated: relativeTime(fit.updatedAt, now),
      value: iskShort(roll.total),
      unpriced: unpricedNote(roll.unpriced),
    };
  });

  return {
    rows,
    fittings: fittings.map((f) => ({
      id: f.fittingId, label: f.name === "" ? `Fitting ${f.fittingId}` : f.name,
    })),
    ships: assembledShips(assets, data).map((group) => ({
      id: group.ship.itemId, label: group.ship.name ?? typeName(group.ship.typeId),
    })),
  };
}
