import { getPool } from "./client.js";
import { chunk } from "../chunk.js";
import type { CharacterKillmailLink, KillmailWrite } from "../combat/killmail.js";

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
 * (which carries no zkb block at all) cannot blank them. `source` is whichever source got there
 * first — it records provenance, not freshness.
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
         WHERE killmails.zkb_total_value IS NULL AND EXCLUDED.zkb_total_value IS NOT NULL`,
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
