import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import {
  COMBAT_PAGE_SIZE, allCombatRows, countCombatRows, getKillmail, listCombatRows, saveKillmails,
} from "../../src/lib/db/killmails.js";
import { toKillmailWrite, type EsiKillmail } from "../../src/lib/combat/killmail.js";
import { esiFixture } from "../fixtures/esi.js";

let pool: Pool;
const A = 669539978;      // the fixture's victim
const B = 2112625428;     // the fixture's first attacker

function killmail(id: number, time: string, over: Partial<EsiKillmail> = {}): EsiKillmail {
  return { ...esiFixture<EsiKillmail>("killmail"), killmail_id: id, killmail_time: time, ...over };
}

beforeAll(async () => {
  pool = await resetDb();
  await pool.query(
    "INSERT INTO characters (id, name, refresh_token_enc) VALUES ($1, 'A', 'e'), ($2, 'B', 'e')", [A, B]);

  // 1: A's loss, B on the kill. 2: A's loss, older. 3: A's kill only.
  const base = esiFixture<EsiKillmail>("killmail");
  await saveKillmails(
    [
      toKillmailWrite(killmail(1, "2026-09-01T12:00:00Z"), "h1", "esi"),
      toKillmailWrite(killmail(2, "2026-06-01T12:00:00Z"), "h2", "zkb",
        { hash: "h2", totalValue: 12_000_000, points: 3, npc: false, solo: false, awox: false }),
      toKillmailWrite(
        killmail(3, "2026-08-01T12:00:00Z", {
          victim: { ...base.victim, character_id: 90000001 },
          attackers: [{ character_id: A, corporation_id: 98000001, damage_done: 10,
            final_blow: true, security_status: 0.1, ship_type_id: 11393, weapon_type_id: 3025 }],
        }), "h3", "esi"),
    ],
    [
      { characterId: A, killmailId: 1, role: "loss" }, { characterId: B, killmailId: 1, role: "kill" },
      { characterId: A, killmailId: 2, role: "loss" },
      { characterId: A, killmailId: 3, role: "kill" },
    ]);
  await pool.query("UPDATE killmails SET computed_value = 5000000 WHERE killmail_id = 1");
  await pool.query("UPDATE killmails SET computed_value = 999 WHERE killmail_id = 2");
}, 60_000);
afterAll(closePool);

describe("listCombatRows", () => {
  it("pages newest first and prefers the zkb value over the computed one", async () => {
    const rows = await listCombatRows([A], { since: null });
    expect(rows.map((r) => r.killmailId)).toEqual([1, 3, 2]);
    expect(rows[0]).toMatchObject({
      role: "loss", value: 5_000_000, solarSystemId: 30000142,
      victimCharacterId: A, victimCorporationId: 98000001, victimShipTypeId: 621,
      ourShipTypeId: 621, weaponTypeId: null, attackerCount: 3, solo: false, finalBlow: false,
    });
    // killmail 2 has both: zkb_total_value 12,000,000 wins over computed_value 999.
    expect(rows[2].value).toBe(12_000_000);
    // On killmail 3 we were the attacker: our ship and weapon come from the attacker row.
    expect(rows[1]).toMatchObject({ role: "kill", ourShipTypeId: 11393, weaponTypeId: 3025, finalBlow: true });
  });

  it("honours since, limit and offset", async () => {
    expect((await listCombatRows([A], { since: new Date("2026-07-01T00:00:00Z") })).map((r) => r.killmailId))
      .toEqual([1, 3]);
    expect((await listCombatRows([A], { since: null, limit: 1 })).map((r) => r.killmailId)).toEqual([1]);
    expect((await listCombatRows([A], { since: null, limit: 1, offset: 1 })).map((r) => r.killmailId)).toEqual([3]);
    expect(COMBAT_PAGE_SIZE).toBe(50);
  });

  it("shows a killmail both characters were on exactly once, as a loss", async () => {
    const rows = await listCombatRows([A, B], { since: null });
    expect(rows.map((r) => r.killmailId)).toEqual([1, 3, 2]);
    expect(rows[0].role).toBe("loss");
    // The lowest of OUR ids on killmail 1 is A (669539978), who was the victim, so our ship is the
    // ship that died, not B's Rifter.
    expect(rows[0].ourShipTypeId).toBe(621);
  });

  it("picks the LATERAL's lowest attacking character id when neither of ours is the victim", async () => {
    // Neither C nor D is the victim here — both are attackers, on different ships with different
    // weapons. Decision 11 says "our ship" is the lowest of our ids AMONG THE ATTACKERS; this is
    // the only fixture where that pick can't short-circuit via the role='loss' branch, so it is the
    // one case that would catch an ORDER BY a.character_id regression (e.g. ASC flipped to DESC).
    const C = 91000001; // lower id
    const D = 91000002; // higher id
    await pool.query(
      "INSERT INTO characters (id, name, refresh_token_enc) VALUES ($1, 'C', 'e'), ($2, 'D', 'e')", [C, D]);
    const base = esiFixture<EsiKillmail>("killmail");
    await saveKillmails(
      [toKillmailWrite(killmail(4, "2026-08-15T12:00:00Z", {
        victim: { ...base.victim, character_id: 90000002 },
        attackers: [
          { character_id: D, corporation_id: 98000003, damage_done: 50, final_blow: true,
            security_status: 0.2, ship_type_id: 11400, weapon_type_id: 2410 },
          { character_id: C, corporation_id: 98000004, damage_done: 20, final_blow: false,
            security_status: 0.3, ship_type_id: 671, weapon_type_id: 2488 },
        ],
      }), "h4", "esi")],
      [{ characterId: C, killmailId: 4, role: "kill" }, { characterId: D, killmailId: 4, role: "kill" }]);

    const rows = await listCombatRows([C, D], { since: null });
    expect(rows).toHaveLength(1);
    // C < D, so the LATERAL must pick C's row, not D's (D has final_blow and a higher damage_done,
    // so a naive "final blow" or "most damage" pick would wrongly return D's ship/weapon here).
    expect(rows[0]).toMatchObject({
      killmailId: 4, role: "kill", ourShipTypeId: 671, weaponTypeId: 2488, finalBlow: false,
    });
  });

  it("returns nothing for a character with no killmails and for an empty id list", async () => {
    expect(await listCombatRows([], { since: null })).toEqual([]);
    expect(await listCombatRows([1234], { since: null })).toEqual([]);
  });
});

describe("allCombatRows and countCombatRows", () => {
  it("agree with the paged view", async () => {
    expect((await allCombatRows([A], null)).map((r) => r.killmailId)).toEqual([1, 3, 2]);
    expect(await countCombatRows([A], null)).toBe(3);
    expect(await countCombatRows([A, B], null)).toBe(3);
    expect(await countCombatRows([A], new Date("2026-07-01T00:00:00Z"))).toBe(2);
    expect(await countCombatRows([], null)).toBe(0);
  });
});

describe("getKillmail", () => {
  it("returns the head, the attackers in order, the items in order and who of ours was on it", async () => {
    const full = (await getKillmail(1))!;
    expect(full.head).toMatchObject({
      killmailId: 1, killmailHash: "h1", solarSystemId: 30000142, victimCharacterId: A,
      victimShipTypeId: 621, damageTaken: 4210, attackerCount: 3,
      computedValue: 5_000_000, zkbTotalValue: null, source: "esi",
    });
    expect(full.head.killmailTime).toEqual(new Date("2026-09-01T12:00:00Z"));
    expect(full.attackers.map((a) => a.idx)).toEqual([0, 1, 2]);
    expect(full.attackers[1]).toMatchObject({ characterId: 2124678472, finalBlow: true, damageDone: 3010 });
    expect(full.attackers[2]).toMatchObject({ characterId: null, factionId: 500003 });
    expect(full.items.map((i) => i.itemTypeId)).toEqual([3634, 11488, 34, 35, 2456]);
    expect(full.items[2]).toMatchObject({ parentIdx: 1, quantityDestroyed: 5000, quantityDropped: 0 });
    expect(full.roles).toEqual([
      { characterId: A, role: "loss" }, { characterId: B, role: "kill" },
    ]);
  });
  it("is null for a killmail we have never seen", async () => {
    expect(await getKillmail(999999)).toBeNull();
  });
});
