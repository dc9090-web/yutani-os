import { getPool } from "./client.js";
import { chunk } from "../chunk.js";
import type {
  CharacterKillmailLink, KillRole, KillmailAttackerRow, KillmailItemRow, KillmailWrite,
} from "../combat/killmail.js";
import type { StatRow } from "../combat/stats.js";

/** zKillboard hands over 200 killmails a page; 500 rows an INSERT keeps the arrays small. */
export const KILLMAIL_INSERT_BATCH = 500;

const big = (v: number | null): string | null => (v === null ? null : String(v));

/**
 * Which of these killmails we already have. The `killmails` job diffs `/killmails/recent` against
 * this before fetching a single body — killmails are immutable, so a known id is never re-fetched.
 */
export async function knownKillmailIds(ids: number[]): Promise<Set<number>> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return new Set();
  const { rows } = await getPool().query<{ killmailId: string }>(
    `SELECT killmail_id AS "killmailId" FROM killmails WHERE killmail_id = ANY($1::bigint[])`,
    [wanted.map(String)]);
  return new Set(rows.map((r) => Number(r.killmailId)));
}

/**
 * `ON CONFLICT` aborts the whole statement if the same conflict target appears twice in one INSERT's
 * VALUES — "ON CONFLICT DO UPDATE command cannot affect row a second time". A killmail id can appear
 * twice in one call (two characters' cursors turning up the same kill in the same run), so de-dupe
 * defensively before chunking, mirroring `market-prices.ts`'s `dedupeByTypeId`: last write for a
 * given killmail id wins.
 */
function dedupeByKillmailId(writes: KillmailWrite[]): KillmailWrite[] {
  return [...new Map(writes.map((w) => [w.killmail.killmailId, w])).values()];
}

/** Same hazard for `(character_id, killmail_id)`. `loss` wins over `kill` so a duplicate can never
 * regress the upgrade a single call would otherwise have made. */
function dedupeLinks(links: CharacterKillmailLink[]): CharacterKillmailLink[] {
  const byKey = new Map<string, CharacterKillmailLink>();
  for (const link of links) {
    const key = `${link.characterId}:${link.killmailId}`;
    const existing = byKey.get(key);
    if (existing === undefined || (existing.role !== "loss" && link.role === "loss")) byKey.set(key, link);
  }
  return [...byKey.values()];
}

/**
 * One transaction for a batch of killmails and the links that say which of our characters were on
 * them. Spec §3: everything is `ON CONFLICT DO NOTHING` except the five `zkb_*` columns, which are
 * COALESCEd so a later zKillboard sighting fills in what ESI never sends and a later ESI sighting
 * (which carries no zkb block at all) cannot blank them. The `WHERE` clause gates the UPDATE
 * per-column — it fires whenever ANY one of the five columns would go from NULL to a real value,
 * not just `zkb_total_value` — so a zkb record with `points`/`solo`/`npc` but no `totalValue` still
 * lands (a zero-ISK npc kill, for instance, has no total value but does have those flags).
 * `source` is whichever source got there first — it records provenance, not freshness.
 *
 * A link may be upgraded from `kill` to `loss` (a character can be the victim of a killmail we
 * first saw them attacking on — a self-destruct or a mistake in an earlier role assignment) but
 * never downgraded.
 *
 * Returns the number of rows actually written, which is what the scheduler logs.
 */
export async function saveKillmails(
  writes: KillmailWrite[], links: CharacterKillmailLink[],
): Promise<number> {
  writes = dedupeByKillmailId(writes);
  links = dedupeLinks(links);
  if (writes.length === 0 && links.length === 0) return 0;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    let rows = 0;

    for (const batch of chunk(writes, KILLMAIL_INSERT_BATCH)) {
      const k = batch.map((w) => w.killmail);
      const res = await client.query(
        `INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, solar_system_id, moon_id,
           war_id, victim_character_id, victim_corporation_id, victim_alliance_id, victim_faction_id,
           victim_ship_type_id, damage_taken, position_x, position_y, position_z, attacker_count,
           final_blow_character_id, final_blow_ship_type_id, final_blow_weapon_type_id,
           zkb_total_value, zkb_points, zkb_npc, zkb_solo, zkb_awox, source)
         SELECT * FROM unnest($1::bigint[], $2::text[], $3::timestamptz[], $4::int[], $5::bigint[],
           $6::bigint[], $7::bigint[], $8::bigint[], $9::bigint[], $10::int[],
           $11::int[], $12::bigint[], $13::float8[], $14::float8[], $15::float8[], $16::int[],
           $17::bigint[], $18::int[], $19::int[],
           $20::numeric[], $21::int[], $22::bool[], $23::bool[], $24::bool[], $25::text[])
         ON CONFLICT (killmail_id) DO UPDATE SET
           zkb_total_value = COALESCE(EXCLUDED.zkb_total_value, killmails.zkb_total_value),
           zkb_points      = COALESCE(EXCLUDED.zkb_points,      killmails.zkb_points),
           zkb_npc         = COALESCE(EXCLUDED.zkb_npc,         killmails.zkb_npc),
           zkb_solo        = COALESCE(EXCLUDED.zkb_solo,        killmails.zkb_solo),
           zkb_awox        = COALESCE(EXCLUDED.zkb_awox,        killmails.zkb_awox)
         WHERE (EXCLUDED.zkb_total_value IS NOT NULL AND killmails.zkb_total_value IS NULL)
            OR (EXCLUDED.zkb_points      IS NOT NULL AND killmails.zkb_points      IS NULL)
            OR (EXCLUDED.zkb_npc         IS NOT NULL AND killmails.zkb_npc         IS NULL)
            OR (EXCLUDED.zkb_solo        IS NOT NULL AND killmails.zkb_solo        IS NULL)
            OR (EXCLUDED.zkb_awox        IS NOT NULL AND killmails.zkb_awox        IS NULL)`,
        [k.map((r) => String(r.killmailId)), k.map((r) => r.killmailHash), k.map((r) => r.killmailTime),
         k.map((r) => r.solarSystemId), k.map((r) => big(r.moonId)), k.map((r) => big(r.warId)),
         k.map((r) => big(r.victimCharacterId)), k.map((r) => big(r.victimCorporationId)),
         k.map((r) => big(r.victimAllianceId)), k.map((r) => r.victimFactionId),
         k.map((r) => r.victimShipTypeId), k.map((r) => big(r.damageTaken)),
         k.map((r) => r.positionX), k.map((r) => r.positionY), k.map((r) => r.positionZ),
         k.map((r) => r.attackerCount), k.map((r) => big(r.finalBlowCharacterId)),
         k.map((r) => r.finalBlowShipTypeId), k.map((r) => r.finalBlowWeaponTypeId),
         k.map((r) => r.zkbTotalValue), k.map((r) => r.zkbPoints),
         k.map((r) => r.zkbNpc), k.map((r) => r.zkbSolo), k.map((r) => r.zkbAwox),
         k.map((r) => r.source)]);
      rows += res.rowCount ?? 0;

      const attackers = batch.flatMap((w) => w.attackers.map((a) => ({ killmailId: w.killmail.killmailId, ...a })));
      for (const part of chunk(attackers, KILLMAIL_INSERT_BATCH)) {
        const res2 = await client.query(
          `INSERT INTO killmail_attackers (killmail_id, idx, character_id, corporation_id, alliance_id,
             faction_id, ship_type_id, weapon_type_id, damage_done, final_blow, security_status)
           SELECT * FROM unnest($1::bigint[], $2::int[], $3::bigint[], $4::bigint[], $5::bigint[],
             $6::int[], $7::int[], $8::int[], $9::bigint[], $10::bool[], $11::float8[])
           ON CONFLICT (killmail_id, idx) DO NOTHING`,
          [part.map((a) => String(a.killmailId)), part.map((a) => a.idx),
           part.map((a) => big(a.characterId)), part.map((a) => big(a.corporationId)),
           part.map((a) => big(a.allianceId)), part.map((a) => a.factionId),
           part.map((a) => a.shipTypeId), part.map((a) => a.weaponTypeId),
           part.map((a) => String(a.damageDone)), part.map((a) => a.finalBlow),
           part.map((a) => a.securityStatus)]);
        rows += res2.rowCount ?? 0;
      }

      const items = batch.flatMap((w) => w.items.map((i) => ({ killmailId: w.killmail.killmailId, ...i })));
      for (const part of chunk(items, KILLMAIL_INSERT_BATCH)) {
        const res3 = await client.query(
          `INSERT INTO killmail_items (killmail_id, idx, parent_idx, item_type_id, flag, singleton,
             quantity_destroyed, quantity_dropped)
           SELECT * FROM unnest($1::bigint[], $2::int[], $3::int[], $4::int[], $5::int[], $6::int[],
             $7::bigint[], $8::bigint[])
           ON CONFLICT (killmail_id, idx) DO NOTHING`,
          [part.map((i) => String(i.killmailId)), part.map((i) => i.idx), part.map((i) => i.parentIdx),
           part.map((i) => i.itemTypeId), part.map((i) => i.flag), part.map((i) => i.singleton),
           part.map((i) => String(i.quantityDestroyed)), part.map((i) => String(i.quantityDropped))]);
        rows += res3.rowCount ?? 0;
      }
    }

    for (const batch of chunk(links, KILLMAIL_INSERT_BATCH)) {
      const res = await client.query(
        `INSERT INTO character_killmails (character_id, killmail_id, role)
         SELECT * FROM unnest($1::bigint[], $2::bigint[], $3::text[])
         ON CONFLICT (character_id, killmail_id) DO UPDATE SET role = 'loss'
         WHERE character_killmails.role <> 'loss' AND EXCLUDED.role = 'loss'`,
        [batch.map((l) => String(l.characterId)), batch.map((l) => String(l.killmailId)),
         batch.map((l) => l.role)]);
      rows += res.rowCount ?? 0;
    }

    await client.query("COMMIT");
    return rows;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Ids referenced by already-stored killmails (`killmails.victim_*`, `killmail_attackers.*`) that
 * `universe_names` has no row for — the ones an earlier backfill run's `NAMES_PER_RUN_CAP` dropped.
 * Killmails are immutable and never re-processed, so nothing else would ever pick these up again;
 * the backfill job sweeps this after its page loop, bounded by whatever is left of its own
 * per-run cap so this can never itself blow that cap.
 */
export async function unresolvedPartyIds(limit: number): Promise<number[]> {
  if (limit <= 0) return [];
  const { rows } = await getPool().query<{ id: string }>(
    `SELECT DISTINCT ids.id FROM (
       SELECT victim_character_id AS id FROM killmails WHERE victim_character_id IS NOT NULL
       UNION
       SELECT victim_corporation_id AS id FROM killmails WHERE victim_corporation_id IS NOT NULL
       UNION
       SELECT victim_alliance_id AS id FROM killmails WHERE victim_alliance_id IS NOT NULL
       UNION
       SELECT character_id AS id FROM killmail_attackers WHERE character_id IS NOT NULL
       UNION
       SELECT corporation_id AS id FROM killmail_attackers WHERE corporation_id IS NOT NULL
       UNION
       SELECT alliance_id AS id FROM killmail_attackers WHERE alliance_id IS NOT NULL
     ) ids
     WHERE NOT EXISTS (SELECT 1 FROM universe_names un WHERE un.id = ids.id)
     ORDER BY ids.id
     LIMIT $1`,
    [limit]);
  return rows.map((r) => Number(r.id));
}

/** Spec §6: the table shows 50 at a time and "more" loads the next 50. */
export const COMBAT_PAGE_SIZE = 50;
/** A hard ceiling on the statistics query, so "All" on a 20,000-killmail backfill stays bounded. */
export const STAT_ROW_CAP = 20_000;

export interface CombatRow extends StatRow {
  victimCharacterId: number | null; victimCorporationId: number | null; attackerCount: number;
}
export interface CombatQuery { since: Date | null; limit?: number; offset?: number }

interface CombatDbRow {
  killmailId: string; role: KillRole; time: Date; value: string | null;
  solarSystemId: number | null; victimCharacterId: string | null; victimCorporationId: string | null;
  victimShipTypeId: number | null; ourShipTypeId: number | null; weaponTypeId: number | null;
  solo: boolean; finalBlow: boolean; attackerCount: number;
}

const numeric = (v: string | null): number | null => (v === null ? null : Number(v));

/**
 * One killmail, one row, however many of our characters were on it (Decision 11):
 * `DISTINCT ON (killmail_id)` with `role = 'loss'` sorted first means a loss beats a kill, and the
 * LATERAL join picks the attacker row belonging to the LOWEST of our character ids. Displayed value
 * is `zkb_total_value ?? computed_value` (spec §4's ruling).
 */
const COMBAT_SELECT = `
  SELECT DISTINCT ON (k.killmail_id)
    k.killmail_id AS "killmailId",
    ck.role,
    k.killmail_time AS "time",
    COALESCE(k.zkb_total_value, k.computed_value) AS value,
    k.solar_system_id AS "solarSystemId",
    k.victim_character_id AS "victimCharacterId",
    k.victim_corporation_id AS "victimCorporationId",
    k.victim_ship_type_id AS "victimShipTypeId",
    CASE WHEN ck.role = 'loss' THEN k.victim_ship_type_id ELSE mine.ship_type_id END AS "ourShipTypeId",
    CASE WHEN ck.role = 'loss' THEN NULL ELSE mine.weapon_type_id END AS "weaponTypeId",
    COALESCE(k.zkb_solo, k.attacker_count = 1) AS solo,
    COALESCE(mine.final_blow, false) AS "finalBlow",
    k.attacker_count AS "attackerCount"
  FROM character_killmails ck
  JOIN killmails k ON k.killmail_id = ck.killmail_id
  LEFT JOIN LATERAL (
    SELECT a.ship_type_id, a.weapon_type_id, a.final_blow
    FROM killmail_attackers a
    WHERE a.killmail_id = k.killmail_id AND a.character_id = ANY($1::bigint[])
    ORDER BY a.character_id
    LIMIT 1
  ) mine ON true
  WHERE ck.character_id = ANY($1::bigint[])
    AND ($2::timestamptz IS NULL OR k.killmail_time >= $2)
  ORDER BY k.killmail_id, (ck.role = 'loss') DESC`;

function toCombatRow(r: CombatDbRow): CombatRow {
  return {
    killmailId: Number(r.killmailId), role: r.role, time: r.time, value: numeric(r.value),
    solarSystemId: r.solarSystemId,
    victimCharacterId: r.victimCharacterId === null ? null : Number(r.victimCharacterId),
    victimCorporationId: r.victimCorporationId === null ? null : Number(r.victimCorporationId),
    victimShipTypeId: r.victimShipTypeId, ourShipTypeId: r.ourShipTypeId,
    weaponTypeId: r.weaponTypeId, solo: r.solo, finalBlow: r.finalBlow,
    attackerCount: r.attackerCount,
  };
}

async function combatRows(
  characterIds: number[], since: Date | null, limit: number, offset: number,
): Promise<CombatRow[]> {
  if (characterIds.length === 0) return [];
  const { rows } = await getPool().query<CombatDbRow>(
    `SELECT * FROM (${COMBAT_SELECT}) t ORDER BY t."time" DESC, t."killmailId" DESC LIMIT $3 OFFSET $4`,
    [characterIds.map(String), since, limit, offset]);
  return rows.map(toCombatRow);
}

export function listCombatRows(characterIds: number[], q: CombatQuery): Promise<CombatRow[]> {
  return combatRows(characterIds, q.since, q.limit ?? COMBAT_PAGE_SIZE, q.offset ?? 0);
}

/** Every row in the period, for the statistics — capped so "All" cannot page in the whole backfill. */
export function allCombatRows(characterIds: number[], since: Date | null): Promise<CombatRow[]> {
  return combatRows(characterIds, since, STAT_ROW_CAP, 0);
}

export async function countCombatRows(characterIds: number[], since: Date | null): Promise<number> {
  if (characterIds.length === 0) return 0;
  const { rows } = await getPool().query<{ n: number }>(
    `SELECT count(DISTINCT ck.killmail_id)::int AS n
     FROM character_killmails ck
     JOIN killmails k ON k.killmail_id = ck.killmail_id
     WHERE ck.character_id = ANY($1::bigint[])
       AND ($2::timestamptz IS NULL OR k.killmail_time >= $2)`,
    [characterIds.map(String), since]);
  return rows[0]?.n ?? 0;
}

export interface KillmailHeadRow {
  killmailId: number; killmailHash: string; killmailTime: Date;
  solarSystemId: number | null; moonId: number | null; warId: number | null;
  victimCharacterId: number | null; victimCorporationId: number | null;
  victimAllianceId: number | null; victimFactionId: number | null;
  victimShipTypeId: number | null; damageTaken: number | null; attackerCount: number;
  zkbTotalValue: number | null; zkbPoints: number | null;
  zkbNpc: boolean | null; zkbSolo: boolean | null; zkbAwox: boolean | null;
  computedValue: number | null; source: "esi" | "zkb";
}
export interface KillmailFull {
  head: KillmailHeadRow; attackers: KillmailAttackerRow[]; items: KillmailItemRow[];
  roles: { characterId: number; role: KillRole }[];
}

/** The whole killmail for the detail page: four queries, no joins to fan rows out. */
export async function getKillmail(killmailId: number): Promise<KillmailFull | null> {
  const pool = getPool();
  const { rows } = await pool.query<Record<string, string | number | boolean | Date | null>>(
    `SELECT killmail_id AS "killmailId", killmail_hash AS "killmailHash",
            killmail_time AS "killmailTime", solar_system_id AS "solarSystemId",
            moon_id AS "moonId", war_id AS "warId",
            victim_character_id AS "victimCharacterId", victim_corporation_id AS "victimCorporationId",
            victim_alliance_id AS "victimAllianceId", victim_faction_id AS "victimFactionId",
            victim_ship_type_id AS "victimShipTypeId", damage_taken AS "damageTaken",
            attacker_count AS "attackerCount", zkb_total_value AS "zkbTotalValue",
            zkb_points AS "zkbPoints", zkb_npc AS "zkbNpc", zkb_solo AS "zkbSolo",
            zkb_awox AS "zkbAwox", computed_value AS "computedValue", source
     FROM killmails WHERE killmail_id = $1`, [String(killmailId)]);
  const raw = rows[0];
  if (raw === undefined) return null;

  const [attackers, items, roles] = await Promise.all([
    pool.query<Record<string, string | number | boolean | null>>(
      `SELECT idx, character_id AS "characterId", corporation_id AS "corporationId",
              alliance_id AS "allianceId", faction_id AS "factionId", ship_type_id AS "shipTypeId",
              weapon_type_id AS "weaponTypeId", damage_done AS "damageDone",
              final_blow AS "finalBlow", security_status AS "securityStatus"
       FROM killmail_attackers WHERE killmail_id = $1 ORDER BY idx`, [String(killmailId)]),
    pool.query<Record<string, string | number | null>>(
      `SELECT idx, parent_idx AS "parentIdx", item_type_id AS "itemTypeId", flag, singleton,
              quantity_destroyed AS "quantityDestroyed", quantity_dropped AS "quantityDropped"
       FROM killmail_items WHERE killmail_id = $1 ORDER BY idx`, [String(killmailId)]),
    pool.query<{ characterId: string; role: KillRole }>(
      `SELECT character_id AS "characterId", role FROM character_killmails
       WHERE killmail_id = $1 ORDER BY character_id`, [String(killmailId)]),
  ]);

  const big = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
  return {
    head: {
      killmailId, killmailHash: raw.killmailHash as string,
      killmailTime: raw.killmailTime as Date,
      solarSystemId: raw.solarSystemId as number | null,
      moonId: big(raw.moonId), warId: big(raw.warId),
      victimCharacterId: big(raw.victimCharacterId),
      victimCorporationId: big(raw.victimCorporationId),
      victimAllianceId: big(raw.victimAllianceId),
      victimFactionId: raw.victimFactionId as number | null,
      victimShipTypeId: raw.victimShipTypeId as number | null,
      damageTaken: big(raw.damageTaken), attackerCount: raw.attackerCount as number,
      zkbTotalValue: big(raw.zkbTotalValue), zkbPoints: raw.zkbPoints as number | null,
      zkbNpc: raw.zkbNpc as boolean | null, zkbSolo: raw.zkbSolo as boolean | null,
      zkbAwox: raw.zkbAwox as boolean | null,
      computedValue: big(raw.computedValue), source: raw.source as "esi" | "zkb",
    },
    attackers: attackers.rows.map((a) => ({
      idx: a.idx as number, characterId: big(a.characterId), corporationId: big(a.corporationId),
      allianceId: big(a.allianceId), factionId: a.factionId as number | null,
      shipTypeId: a.shipTypeId as number | null, weaponTypeId: a.weaponTypeId as number | null,
      damageDone: Number(a.damageDone), finalBlow: a.finalBlow as boolean,
      securityStatus: a.securityStatus === null ? null : Number(a.securityStatus),
    })),
    items: items.rows.map((i) => ({
      idx: i.idx as number, parentIdx: i.parentIdx as number | null,
      itemTypeId: i.itemTypeId as number, flag: i.flag as number, singleton: i.singleton as number,
      quantityDestroyed: Number(i.quantityDestroyed), quantityDropped: Number(i.quantityDropped),
    })),
    roles: roles.rows.map((r) => ({ characterId: Number(r.characterId), role: r.role })),
  };
}
