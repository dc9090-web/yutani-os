import { getPrices } from "../db/market-prices.js";
import { placeViews } from "../names/place.js";
import { loadFitData, type FitData } from "../ships/load.js";
import { masteryLevel } from "../ships/mastery.js";
import { assetSheet, fittingSheet, type SheetResult } from "../ships/sheet.js";
import { getMasteryRequirements, getRaces, getTypes } from "../sde/repo.js";
import { assembledShips, assetShipCards, rootLocationId, savedFitCards, sortShipPanels, type ShipCardView } from "../view/ships.js";

export interface ShipsData {
  /** False until skills have synced: every skill counts as level 0 and the numbers are worst case. */
  skillsSynced: boolean;
  /** Assembled ships in the character's assets, ordered by hull type and then value. */
  ships: ShipCardView[];
  /** Fits saved in game, in the same order. */
  fits: ShipCardView[];
}

/**
 * Ships: one card per fitted ship and per saved fit. `data` is for a caller that builds several
 * ship resources for one character and has already read the fit data once.
 */
export async function loadShips(characterId: number, data?: FitData): Promise<ShipsData> {
  const { assets, fittings, ctx, skillsSynced } = data ?? await loadFitData(characterId);
  const groups = assembledShips(assets, ctx.data);
  const byItemId = new Map(assets.map((a) => [a.itemId, a]));

  // Batched lookups for the whole page: one price query over every type the character owns or has
  // in a fitting, one locationLabels pass over the places the ships are parked in (ships sitting
  // inside another item are labelled from the asset rows), and one mastery query over the hulls.
  const priceIds = [
    ...assets.map((a) => a.typeId),
    ...fittings.flatMap((f) => [f.shipTypeId, ...f.items.map((i) => i.typeId)]),
  ];
  // The hull's race is not in `DogmaData` — one `getTypes` batch over the hull ids, joined against
  // the (tiny, unfiltered) race table.
  const hullTypeIds = [...new Set([...groups.map((g) => g.ship.typeId), ...fittings.map((f) => f.shipTypeId)])];
  const [prices, places, hullTypes, races, mastery] = await Promise.all([
    getPrices(priceIds),
    // Every ship's real place — a ship in a container is where the container is — with its system's security.
    placeViews(groups.map((g) => rootLocationId(g.ship, byItemId))),
    getTypes(hullTypeIds),
    getRaces(),
    getMasteryRequirements(hullTypeIds),
  ]);
  const raceNames = new Map<number, string>();
  for (const [typeId, type] of hullTypes) {
    const raceName = type.raceId === null ? undefined : races.get(type.raceId);
    if (raceName !== undefined) raceNames.set(typeId, raceName);
  }
  // Mastery is a claim about the pilot's skills: until they have synced there is nothing to say.
  const masteryOf = (typeId: number): number | null => (skillsSynced ? masteryLevel(mastery.get(typeId), ctx.skills) : null);

  return {
    skillsSynced,
    ships: sortShipPanels(assetShipCards(groups, ctx, places, byItemId, prices, raceNames, masteryOf)),
    fits: sortShipPanels(savedFitCards(fittings, ctx, prices, raceNames, masteryOf)),
  };
}

/**
 * Ship detail for an assembled ship in the character's assets. The sheet's `droneControl` is the
 * `DroneLimits` the drone selector sums over, and `weapons` the turret and launcher figures it adds
 * the launched drones to — both plain numbers, so a reader can do the sum itself.
 */
export function loadAssetSheet(characterId: number, itemId: number, data?: FitData): Promise<SheetResult> {
  return assetSheet(characterId, itemId, data);
}

/** Ship detail for a fit saved in game. */
export function loadFittingSheet(characterId: number, fittingId: number, data?: FitData): Promise<SheetResult> {
  return fittingSheet(characterId, fittingId, data);
}
