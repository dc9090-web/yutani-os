/**
 * The ESI killmail body and the rows it becomes. Pure and isomorphic: no `pg`, no `node:*`, so the
 * repo, the worker jobs and the zKillboard parser all share one set of shapes.
 *
 * Killmails are immutable, which is why nothing here has an "update" form — a body is mapped once
 * and stored once. Only the `zkb_*` columns can arrive later, from a different source.
 */
export interface EsiKillmailItem {
  item_type_id: number; flag: number; singleton: number;
  quantity_destroyed?: number; quantity_dropped?: number; items?: EsiKillmailItem[];
}
export interface EsiKillmailVictim {
  character_id?: number; corporation_id?: number; alliance_id?: number; faction_id?: number;
  damage_taken: number; ship_type_id: number;
  position?: { x: number; y: number; z: number }; items?: EsiKillmailItem[];
}
export interface EsiKillmailAttacker {
  character_id?: number; corporation_id?: number; alliance_id?: number; faction_id?: number;
  damage_done: number; final_blow: boolean; security_status: number;
  ship_type_id?: number; weapon_type_id?: number;
}
export interface EsiKillmail {
  killmail_id: number; killmail_time: string; solar_system_id: number;
  moon_id?: number; war_id?: number;
  victim: EsiKillmailVictim; attackers: EsiKillmailAttacker[];
}

/** zKillboard's own block. Only `hash` is guaranteed; the rest are best-effort extras (research §6). */
export interface ZkbBlock {
  hash: string; totalValue?: number; points?: number; npc?: boolean; solo?: boolean; awox?: boolean;
}

export interface KillmailItemRow {
  idx: number; parentIdx: number | null; itemTypeId: number; flag: number; singleton: number;
  quantityDestroyed: number; quantityDropped: number;
}
export interface KillmailAttackerRow {
  idx: number; characterId: number | null; corporationId: number | null; allianceId: number | null;
  factionId: number | null; shipTypeId: number | null; weaponTypeId: number | null;
  damageDone: number; finalBlow: boolean; securityStatus: number | null;
}
export interface KillmailRow {
  killmailId: number; killmailHash: string; killmailTime: Date;
  solarSystemId: number | null; moonId: number | null; warId: number | null;
  victimCharacterId: number | null; victimCorporationId: number | null;
  victimAllianceId: number | null; victimFactionId: number | null;
  victimShipTypeId: number | null; damageTaken: number | null;
  positionX: number | null; positionY: number | null; positionZ: number | null;
  attackerCount: number; finalBlowCharacterId: number | null;
  finalBlowShipTypeId: number | null; finalBlowWeaponTypeId: number | null;
  zkbTotalValue: number | null; zkbPoints: number | null;
  zkbNpc: boolean | null; zkbSolo: boolean | null; zkbAwox: boolean | null;
  source: "esi" | "zkb";
}
export interface KillmailWrite {
  killmail: KillmailRow; attackers: KillmailAttackerRow[]; items: KillmailItemRow[];
}

export type KillRole = "kill" | "loss";
export interface CharacterKillmailLink { characterId: number; killmailId: number; role: KillRole }

const num = (v: number | undefined): number | null => (v === undefined ? null : v);
const bool = (v: boolean | undefined): boolean | null => (v === undefined ? null : v);

/**
 * ESI nests `items` exactly one level — a container's contents (research §6). Flattening is depth
 * first, so a container is immediately followed by what was inside it and `parentIdx` points back
 * at the container's own `idx`. `quantity_destroyed` and `quantity_dropped` are both optional and
 * normally exactly one is present; the absent one is stored as 0, never NULL, so the value job can
 * add them without a COALESCE.
 */
export function flattenItems(items: EsiKillmailItem[] | undefined): KillmailItemRow[] {
  const out: KillmailItemRow[] = [];
  const push = (item: EsiKillmailItem, parentIdx: number | null): number => {
    const idx = out.length;
    out.push({
      idx, parentIdx, itemTypeId: item.item_type_id, flag: item.flag, singleton: item.singleton,
      quantityDestroyed: item.quantity_destroyed ?? 0, quantityDropped: item.quantity_dropped ?? 0,
    });
    return idx;
  };
  for (const item of items ?? []) {
    const parent = push(item, null);
    for (const child of item.items ?? []) push(child, parent);
  }
  return out;
}

export function toKillmailWrite(
  body: EsiKillmail, hash: string, source: "esi" | "zkb", zkb?: ZkbBlock,
): KillmailWrite {
  const attackers: KillmailAttackerRow[] = body.attackers.map((a, idx) => ({
    idx,
    characterId: num(a.character_id), corporationId: num(a.corporation_id),
    allianceId: num(a.alliance_id), factionId: num(a.faction_id),
    shipTypeId: num(a.ship_type_id), weaponTypeId: num(a.weapon_type_id),
    damageDone: a.damage_done, finalBlow: a.final_blow, securityStatus: a.security_status,
  }));
  const final = attackers.find((a) => a.finalBlow) ?? null;
  const position = body.victim.position;
  return {
    killmail: {
      killmailId: body.killmail_id, killmailHash: hash,
      killmailTime: new Date(body.killmail_time),
      solarSystemId: body.solar_system_id, moonId: num(body.moon_id), warId: num(body.war_id),
      victimCharacterId: num(body.victim.character_id),
      victimCorporationId: num(body.victim.corporation_id),
      victimAllianceId: num(body.victim.alliance_id),
      victimFactionId: num(body.victim.faction_id),
      victimShipTypeId: body.victim.ship_type_id, damageTaken: body.victim.damage_taken,
      positionX: position?.x ?? null, positionY: position?.y ?? null, positionZ: position?.z ?? null,
      attackerCount: attackers.length,
      finalBlowCharacterId: final?.characterId ?? null,
      finalBlowShipTypeId: final?.shipTypeId ?? null,
      finalBlowWeaponTypeId: final?.weaponTypeId ?? null,
      zkbTotalValue: num(zkb?.totalValue), zkbPoints: num(zkb?.points),
      zkbNpc: bool(zkb?.npc), zkbSolo: bool(zkb?.solo), zkbAwox: bool(zkb?.awox),
      source,
    },
    attackers,
    items: flattenItems(body.victim.items),
  };
}

/** Spec §3: `loss` when the character is the victim, `kill` when they are among the attackers. */
export function roleFor(body: EsiKillmail, characterId: number): KillRole | null {
  if (body.victim.character_id === characterId) return "loss";
  return body.attackers.some((a) => a.character_id === characterId) ? "kill" : null;
}

/**
 * Every id worth a name: victim and attacker characters, their corporations and their alliances.
 * The jobs feed this to `resolveNames` so the pages can stay Postgres-only (Decision 3).
 */
export function partyIds(body: EsiKillmail): number[] {
  const ids = new Set<number>();
  const add = (id: number | undefined): void => { if (typeof id === "number" && id > 0) ids.add(id); };
  add(body.victim.character_id); add(body.victim.corporation_id); add(body.victim.alliance_id);
  for (const a of body.attackers) { add(a.character_id); add(a.corporation_id); add(a.alliance_id); }
  return [...ids];
}
