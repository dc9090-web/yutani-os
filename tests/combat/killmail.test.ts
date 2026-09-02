import { describe, it, expect } from "vitest";
import {
  flattenItems, partyIds, roleFor, toKillmailWrite, type EsiKillmail,
} from "../../src/lib/combat/killmail.js";
import { esiFixture } from "../fixtures/esi.js";

const body = (): EsiKillmail => esiFixture<EsiKillmail>("killmail");
const VICTIM = 669539978;
const ATTACKER = 2112625428;

describe("flattenItems", () => {
  it("is depth first: a container's contents follow it and carry its idx as parentIdx", () => {
    expect(flattenItems(body().victim.items)).toEqual([
      { idx: 0, parentIdx: null, itemTypeId: 3634, flag: 27, singleton: 0,
        quantityDestroyed: 0, quantityDropped: 1 },
      { idx: 1, parentIdx: null, itemTypeId: 11488, flag: 5, singleton: 0,
        quantityDestroyed: 1, quantityDropped: 0 },
      { idx: 2, parentIdx: 1, itemTypeId: 34, flag: 0, singleton: 0,
        quantityDestroyed: 5000, quantityDropped: 0 },
      { idx: 3, parentIdx: 1, itemTypeId: 35, flag: 0, singleton: 0,
        quantityDestroyed: 0, quantityDropped: 2000 },
      { idx: 4, parentIdx: null, itemTypeId: 2456, flag: 87, singleton: 0,
        quantityDestroyed: 5, quantityDropped: 0 },
    ]);
  });
  it("returns an empty list when the victim carried nothing", () => {
    expect(flattenItems(undefined)).toEqual([]);
    expect(flattenItems([])).toEqual([]);
  });
});

describe("toKillmailWrite", () => {
  it("maps the header, counts attackers and copies the final blow onto the killmail", () => {
    const w = toKillmailWrite(body(), "a1b2c3", "esi");
    expect(w.killmail).toEqual({
      killmailId: 120000001, killmailHash: "a1b2c3",
      killmailTime: new Date("2026-09-01T12:00:00Z"),
      solarSystemId: 30000142, moonId: null, warId: null,
      victimCharacterId: VICTIM, victimCorporationId: 98000001,
      victimAllianceId: 99000001, victimFactionId: null,
      victimShipTypeId: 621, damageTaken: 4210,
      positionX: 1.5e11, positionY: -2.5e10, positionZ: 3.75e11,
      attackerCount: 3, finalBlowCharacterId: 2124678472,
      finalBlowShipTypeId: 11393, finalBlowWeaponTypeId: 3025,
      zkbTotalValue: null, zkbPoints: null, zkbNpc: null, zkbSolo: null, zkbAwox: null,
      source: "esi",
    });
  });
  it("maps attackers in ESI's order, nulling every absent optional field", () => {
    const w = toKillmailWrite(body(), "a1b2c3", "esi");
    expect(w.attackers).toHaveLength(3);
    expect(w.attackers[0]).toEqual({
      idx: 0, characterId: ATTACKER, corporationId: 98000002, allianceId: null, factionId: null,
      shipTypeId: 587, weaponTypeId: 2929, damageDone: 1200, finalBlow: false, securityStatus: -1.4,
    });
    expect(w.attackers[2]).toEqual({
      idx: 2, characterId: null, corporationId: null, allianceId: null, factionId: 500003,
      shipTypeId: null, weaponTypeId: null, damageDone: 0, finalBlow: false, securityStatus: 0,
    });
  });
  it("copies the zkb block when one is supplied", () => {
    const w = toKillmailWrite(body(), "a1b2c3", "zkb", {
      hash: "a1b2c3", totalValue: 60633419.79, points: 1, npc: false, solo: true, awox: false,
    });
    expect(w.killmail.source).toBe("zkb");
    expect(w.killmail.zkbTotalValue).toBe(60633419.79);
    expect(w.killmail.zkbPoints).toBe(1);
    expect([w.killmail.zkbNpc, w.killmail.zkbSolo, w.killmail.zkbAwox]).toEqual([false, true, false]);
  });
  it("leaves the whole zkb block null when there is none, and position null when ESI omits it", () => {
    const raw = body();
    delete raw.victim.position;
    const w = toKillmailWrite(raw, "a1b2c3", "esi");
    expect([w.killmail.positionX, w.killmail.positionY, w.killmail.positionZ]).toEqual([null, null, null]);
    expect(w.killmail.zkbTotalValue).toBeNull();
  });
});

describe("roleFor", () => {
  it("is a loss for the victim, a kill for an attacker and null for a bystander", () => {
    expect(roleFor(body(), VICTIM)).toBe("loss");
    expect(roleFor(body(), ATTACKER)).toBe("kill");
    expect(roleFor(body(), 2124678472)).toBe("kill");
    expect(roleFor(body(), 1)).toBeNull();
  });
});

describe("partyIds", () => {
  it("collects every character, corporation and alliance id exactly once", () => {
    expect(partyIds(body()).sort((a, b) => a - b)).toEqual([
      98000001, 98000002, 99000001, 99000002, 669539978, 2112625428, 2124678472,
    ].sort((a, b) => a - b));
  });
});
