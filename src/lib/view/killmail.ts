import {
  KILLMAIL_SLOT_ORDER, SLOT_TITLES, slotOfFlag, type KillmailSlot,
} from "../combat/flags.js";
import type { KillmailFull } from "../db/killmails.js";
import { portraitUrl } from "./characters.js";
import { nameOf, typeOf, type Labels } from "./combat.js";
import { grouped, isk, secClass, secText, stamp } from "./format.js";
import { iskShort, priceOf, type Price } from "./price.js";

const DASH = "—";
export const ZKILLBOARD_KILL_URL = "https://zkillboard.com/kill/";

/**
 * These two are copied rather than imported from `src/lib/view/fit-sheet.ts` /
 * `src/lib/fits/editor-view.ts`: both of those modules pull the whole dogma engine in for a
 * one-line string, and this module has no other reason to depend on it.
 */
const iconUrl = (typeId: number): string =>
  `https://images.evetech.net/types/${typeId}/icon?size=32`;
const renderUrl = (typeId: number): string =>
  `https://images.evetech.net/types/${typeId}/render?size=128`;

export interface KillmailHeaderView {
  killmailId: number; time: string; system: string; secClass: string; secText: string;
  value: string; roleLabel: string | null; zkbHref: string; points: string | null;
  flags: string[];
}
export interface VictimView {
  name: string; corp: string; alliance: string | null; portrait: string | null;
  shipTypeId: number | null; shipName: string; shipRender: string | null; damageTaken: string;
}
export interface FitItemView {
  idx: number; typeId: number; icon: string; name: string;
  destroyed: string | null; dropped: string | null; value: string; inContainer: string | null;
}
export interface FitSlotView { slot: KillmailSlot; title: string; rows: FitItemView[] }
export interface AttackerView {
  idx: number; name: string; corp: string; alliance: string | null;
  ship: string; shipTypeId: number | null; weapon: string;
  damage: string; share: string; finalBlow: boolean; security: string;
}
export interface KillmailView {
  header: KillmailHeaderView; victim: VictimView;
  slots: FitSlotView[]; attackers: AttackerView[]; fittedTypeIds: number[];
}

/** Spec §4's ruling: the displayed value is zKillboard's, falling back to ours. */
function displayValue(head: KillmailFull["head"]): number | null {
  return head.zkbTotalValue ?? head.computedValue;
}

/** The slots a fit can actually hold — what "Open in fitting designer" is allowed to use. */
const FITTABLE: ReadonlySet<KillmailSlot> = new Set<KillmailSlot>([
  "high", "mid", "low", "rig", "subsystem", "drone",
]);

export function killmailView(
  full: KillmailFull, labels: Labels, prices: ReadonlyMap<number, Price>, viewerIds: number[],
): KillmailView {
  const head = full.head;
  const system = head.solarSystemId === null ? undefined : labels.systems.get(head.solarSystemId);
  const security = system?.security ?? null;
  const value = displayValue(head);

  // A killmail several of our characters were on is a loss if any of them died (Decision 11).
  const mine = full.roles.filter((r) => viewerIds.includes(r.characterId));
  const roleLabel = mine.length === 0 ? null : mine.some((r) => r.role === "loss") ? "Loss" : "Kill";

  const flags = [
    head.zkbSolo === true ? "Solo" : null,
    head.zkbNpc === true ? "NPC" : null,
    head.zkbAwox === true ? "Awox" : null,
  ].filter((f): f is string => f !== null);

  const byIdx = new Map(full.items.map((i) => [i.idx, i]));
  const bySlot = new Map<KillmailSlot, FitItemView[]>();
  const fittedTypeIds: number[] = [];
  for (const item of full.items) {
    // A container's contents belong to the container's slot, not to flag 0's "other".
    const parent = item.parentIdx === null ? null : byIdx.get(item.parentIdx) ?? null;
    const slot = slotOfFlag(parent === null ? item.flag : parent.flag);
    const unit = priceOf(prices.get(item.itemTypeId));
    const quantity = item.quantityDestroyed + item.quantityDropped;
    const rows = bySlot.get(slot) ?? [];
    rows.push({
      idx: item.idx, typeId: item.itemTypeId, icon: iconUrl(item.itemTypeId),
      name: typeOf(item.itemTypeId, labels),
      destroyed: item.quantityDestroyed > 0 ? grouped(item.quantityDestroyed) : null,
      dropped: item.quantityDropped > 0 ? grouped(item.quantityDropped) : null,
      value: unit === null ? DASH : isk(unit * quantity),
      inContainer: parent === null ? null : typeOf(parent.itemTypeId, labels),
    });
    bySlot.set(slot, rows);
    if (parent === null && FITTABLE.has(slot)) fittedTypeIds.push(item.itemTypeId);
  }
  const slots: FitSlotView[] = KILLMAIL_SLOT_ORDER
    .filter((slot) => bySlot.has(slot))
    .map((slot) => ({ slot, title: SLOT_TITLES[slot], rows: bySlot.get(slot)! }));

  const damageTaken = head.damageTaken ?? 0;
  const attackers: AttackerView[] = [...full.attackers]
    .sort((a, b) => (b.damageDone - a.damageDone) || (a.idx - b.idx))
    .map((a) => ({
      idx: a.idx,
      name: nameOf(a.characterId, labels),
      corp: nameOf(a.corporationId, labels),
      alliance: a.allianceId === null ? null : nameOf(a.allianceId, labels),
      ship: typeOf(a.shipTypeId, labels), shipTypeId: a.shipTypeId,
      weapon: typeOf(a.weaponTypeId, labels),
      damage: grouped(a.damageDone),
      share: damageTaken === 0 ? DASH : `${((a.damageDone / damageTaken) * 100).toFixed(1)}%`,
      finalBlow: a.finalBlow,
      security: a.securityStatus === null ? DASH : a.securityStatus.toFixed(1),
    }));

  return {
    header: {
      killmailId: head.killmailId, time: stamp(head.killmailTime),
      system: system?.name
        ?? (head.solarSystemId === null ? DASH : `Unknown system (${head.solarSystemId})`),
      secClass: system === undefined ? "sec-null" : secClass(security),
      secText: system === undefined ? DASH : secText(security),
      value: value === null ? DASH : iskShort(value),
      roleLabel,
      zkbHref: `${ZKILLBOARD_KILL_URL}${head.killmailId}/`,
      points: head.zkbPoints === null ? null : grouped(head.zkbPoints),
      flags,
    },
    victim: {
      name: nameOf(head.victimCharacterId, labels),
      corp: nameOf(head.victimCorporationId, labels),
      alliance: head.victimAllianceId === null ? null : nameOf(head.victimAllianceId, labels),
      portrait: head.victimCharacterId === null ? null : portraitUrl(head.victimCharacterId, 128),
      shipTypeId: head.victimShipTypeId,
      shipName: typeOf(head.victimShipTypeId, labels),
      shipRender: head.victimShipTypeId === null ? null : renderUrl(head.victimShipTypeId),
      damageTaken: grouped(damageTaken),
    },
    slots, attackers, fittedTypeIds,
  };
}
