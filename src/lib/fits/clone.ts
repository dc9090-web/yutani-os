/**
 * The three "make me a new fit" sources (spec §6). Server only: this module reaches for the SDE
 * loader and the repos, so nothing under `src/app/fitting/**` may import it.
 */
import { createFit, type FitRow } from "../db/fits.js";
import { fitFromAssets, fitFromFitting } from "../dogma/index.js";
import { loadDogmaData } from "../dogma/sde-loader.js";
import { getTypesByNames } from "../sde/repo.js";
import { loadFitData } from "../ships/load.js";
import { assembledShips } from "../view/ships.js";
import { docItemsFromBuilt } from "./doc.js";
import { assignEftItems, tokeniseEft } from "./eft.js";

export type CloneOutcome =
  | { kind: "ok"; fit: FitRow; unresolved: string[] }
  | { kind: "notFound" }
  | { kind: "failed" };

/** Spec §5: names resolve against `sde_types`, exact and case-insensitive; unknowns are reported. */
export async function fitFromEftText(text: string): Promise<CloneOutcome> {
  const parsed = tokeniseEft(text);
  if (parsed === null) return { kind: "failed" };

  const names = [parsed.shipName];
  for (const line of parsed.lines) {
    if (line.empty !== null) continue;
    names.push(line.name);
    if (line.chargeName !== null) names.push(line.chargeName);
  }

  const byName = await getTypesByNames(names);
  const data = await loadDogmaData([...new Set(byName.values())]);
  const assigned = assignEftItems(parsed, byName, data);
  if (assigned === null) return { kind: "failed" };       // the hull itself did not resolve

  // EFT text carries no pilot, so an imported fit is All skills V until you pick a character.
  const fit = await createFit({
    name: assigned.name, shipTypeId: assigned.shipTypeId, characterId: null, items: assigned.items,
  });
  return { kind: "ok", fit, unresolved: assigned.unresolved };
}

export async function fitFromSavedFitting(characterId: number, fittingId: number): Promise<CloneOutcome> {
  const loaded = await loadFitData(characterId);
  const fitting = loaded.fittings.find((f) => f.fittingId === fittingId);
  if (fitting === undefined) return { kind: "notFound" };

  try {
    const built = fitFromFitting(fitting, fitting.items, loaded.ctx);
    const fit = await createFit({
      name: fitting.name === "" ? `Fitting ${fittingId}` : fitting.name,
      description: fitting.description,
      shipTypeId: fitting.shipTypeId,
      characterId,
      items: docItemsFromBuilt(built),
    });
    return { kind: "ok", fit, unresolved: [] };
  } catch (e) {
    console.error(`[fits] could not clone fitting ${fittingId}`, e);
    return { kind: "failed" };
  }
}

export async function fitFromAssetShip(characterId: number, itemId: number): Promise<CloneOutcome> {
  const loaded = await loadFitData(characterId);
  const group = assembledShips(loaded.assets, loaded.ctx.data).find((g) => g.ship.itemId === itemId);
  if (group === undefined) return { kind: "notFound" };

  try {
    const built = fitFromAssets(group.ship, group.children, loaded.ctx);
    const typeName = loaded.ctx.data.types.get(group.ship.typeId)?.name;
    const fit = await createFit({
      name: group.ship.name ?? typeName ?? `Ship ${itemId}`,
      description: "",
      shipTypeId: group.ship.typeId,
      characterId,
      items: docItemsFromBuilt(built),
    });
    return { kind: "ok", fit, unresolved: [] };
  } catch (e) {
    console.error(`[fits] could not clone assembled ship ${itemId}`, e);
    return { kind: "failed" };
  }
}
