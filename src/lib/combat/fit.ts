/**
 * "Open in fitting designer" (spec §6). Server only: it reads the killmail, the dogma data and the
 * fits repo. Never import this from a `"use client"` component.
 */
import { createFit } from "../db/fits.js";
import { getKillmail } from "../db/killmails.js";
import { DRONE_BAY_FLAG, slotOfType, type DogmaType } from "../dogma/index.js";
import { loadDogmaData } from "../dogma/sde-loader.js";
import type { CloneOutcome } from "../fits/clone.js";
import { CARGO_FLAG, type FitItem } from "../fits/doc.js";
import { clampFitName } from "../fits/parse.js";
import { fitFlagOfFlag } from "./flags.js";
import type { KillmailItemRow } from "./killmail.js";

/**
 * Killmail items → phase-5 fit items. The numeric flag carries the slot index, so a module lands in
 * exactly the slot the victim had it in.
 *
 * Two rows can share one flag — a launcher and the ammo loaded in it are both `HiSlot0`. The row
 * whose type has a fitting slot (`slotOfType`) is the module; a second row on the same flag is its
 * charge (Decision 14). Contents of containers (`parentIdx !== null`), cargo, implants, fighters and
 * unknown flags are dropped: they were never fitted.
 *
 * Note: `fitFlagOfFlag` accepts the whole 125–132 subsystem band (Decision 13), so flags 129–132
 * would map to `SubSystemSlot4`..`SubSystemSlot7` here too — slots that never occur in game (a ship
 * has at most four subsystems). Harmless: ESI never emits those flags, so this wider range simply
 * never fires for them, exactly as `flags.ts`'s own docstring already notes for `slotOfFlag`.
 */
export function killmailFitItems(
  items: KillmailItemRow[], data: { types: ReadonlyMap<number, DogmaType> },
): FitItem[] {
  const byFlag = new Map<string, KillmailItemRow[]>();
  for (const item of items) {
    if (item.parentIdx !== null) continue;
    const flag = fitFlagOfFlag(item.flag);
    if (flag === null || flag === CARGO_FLAG) continue;
    const rows = byFlag.get(flag) ?? [];
    rows.push(item);
    byFlag.set(flag, rows);
  }

  const out: FitItem[] = [];
  for (const [flag, rows] of byFlag) {
    if (flag === DRONE_BAY_FLAG) {
      for (const row of rows) {
        out.push({
          typeId: row.itemTypeId,
          quantity: Math.max(1, row.quantityDestroyed + row.quantityDropped),
          flag, chargeTypeId: null, state: "active",
        });
      }
      continue;
    }
    const isModule = (row: KillmailItemRow): boolean => {
      const type = data.types.get(row.itemTypeId);
      return type !== undefined && slotOfType(type) !== null;
    };
    const module = rows.find(isModule) ?? rows[0];
    const charge = rows.find((row) => row !== module) ?? null;
    out.push({
      typeId: module.itemTypeId, quantity: 1, flag,
      chargeTypeId: charge === null ? null : charge.itemTypeId, state: "active",
    });
  }
  return out;
}

export async function fitFromKillmail(
  killmailId: number, characterId: number | null,
): Promise<CloneOutcome> {
  const full = await getKillmail(killmailId);
  if (full === null) return { kind: "notFound" };
  const shipTypeId = full.head.victimShipTypeId;
  if (shipTypeId === null) return { kind: "failed" };

  try {
    const typeIds = [shipTypeId, ...full.items.map((i) => i.itemTypeId)];
    const data = await loadDogmaData([...new Set(typeIds)]);
    const shipName = data.types.get(shipTypeId)?.name ?? `Type ${shipTypeId}`;
    const fit = await createFit({
      name: clampFitName(`${shipName} — killmail ${killmailId}`),
      description: `Imported from killmail ${killmailId}`,
      shipTypeId,
      characterId,
      items: killmailFitItems(full.items, data),
    });
    return { kind: "ok", fit, unresolved: [] };
  } catch (e) {
    console.error(`[combat] could not build a fit from killmail ${killmailId}`, e);
    return { kind: "failed" };
  }
}
