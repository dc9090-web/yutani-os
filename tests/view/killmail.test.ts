import { describe, it, expect } from "vitest";
import { killmailView, ZKILLBOARD_KILL_URL } from "../../src/lib/view/killmail.js";
import type { Labels } from "../../src/lib/view/combat.js";
import type { KillmailFull } from "../../src/lib/db/killmails.js";
import type { Price } from "../../src/lib/view/price.js";

const A = 669539978;
const price = (sell: number | null): Price => ({ sell, buy: null, adjusted: null });

const labels: Labels = {
  names: new Map([
    [A, "TrilliumONE"], [98000001, "Trill Industries"], [99000001, "Trill Alliance"],
    [2112625428, "Bad Guy"], [98000002, "Bad Corp"],
  ]),
  types: new Map([
    [621, "Caracal"], [587, "Rifter"], [3634, "Heavy Missile Launcher II"],
    [11488, "Small Secure Container"], [34, "Tritanium"], [2456, "Warrior II"],
    [2929, "150mm Light AutoCannon II"],
  ]),
  systems: new Map([[30000142, { name: "Jita", security: 0.946 }]]),
};

const prices = new Map<number, Price>([
  [3634, price(2_000_000)], [34, price(5)], [2456, price(500_000)],
]);

const full: KillmailFull = {
  head: {
    killmailId: 120000001, killmailHash: "h", killmailTime: new Date("2026-09-01T12:00:00Z"),
    solarSystemId: 30000142, moonId: null, warId: null,
    victimCharacterId: A, victimCorporationId: 98000001, victimAllianceId: 99000001,
    victimFactionId: null, victimShipTypeId: 621, damageTaken: 4210, attackerCount: 2,
    zkbTotalValue: 60_633_419.79, zkbPoints: 7, zkbNpc: false, zkbSolo: false, zkbAwox: false,
    computedValue: 8_125_000, source: "zkb",
  },
  attackers: [
    { idx: 0, characterId: 2112625428, corporationId: 98000002, allianceId: null, factionId: null,
      shipTypeId: 587, weaponTypeId: 2929, damageDone: 1200, finalBlow: false, securityStatus: -1.4 },
    { idx: 1, characterId: null, corporationId: null, allianceId: null, factionId: 500003,
      shipTypeId: null, weaponTypeId: null, damageDone: 3010, finalBlow: true, securityStatus: 0 },
  ],
  items: [
    { idx: 0, parentIdx: null, itemTypeId: 3634, flag: 27, singleton: 0,
      quantityDestroyed: 1, quantityDropped: 0 },
    { idx: 1, parentIdx: null, itemTypeId: 11488, flag: 5, singleton: 0,
      quantityDestroyed: 1, quantityDropped: 0 },
    { idx: 2, parentIdx: 1, itemTypeId: 34, flag: 0, singleton: 0,
      quantityDestroyed: 5000, quantityDropped: 0 },
    { idx: 3, parentIdx: null, itemTypeId: 2456, flag: 87, singleton: 0,
      quantityDestroyed: 3, quantityDropped: 2 },
  ],
  roles: [{ characterId: A, role: "loss" }],
};

describe("killmailView", () => {
  const view = killmailView(full, labels, prices, A);

  it("builds the header, preferring the zKillboard value", () => {
    expect(view.header).toEqual({
      killmailId: 120000001, time: "2026-09-01 12:00",
      system: "Jita", secClass: "sec-high", secText: "0.9",
      // iskShort(60,633,419.79) = (60.633…).toFixed(1) = "60.6M ISK"
      value: "60.6M ISK", roleLabel: "Loss",
      zkbHref: `${ZKILLBOARD_KILL_URL}120000001/`, points: "7", flags: [],
    });
  });

  it("has no role label when the active character was not on this killmail, and lists the zkb flags", () => {
    const solo = killmailView(
      { ...full, head: { ...full.head, zkbSolo: true, zkbNpc: true }, roles: [] }, labels, prices, A);
    expect(solo.header.roleLabel).toBeNull();
    expect(solo.header.flags).toEqual(["Solo", "NPC"]);
  });

  it("labels Kill when the active character is an attacker rather than the victim", () => {
    const kill = killmailView(
      { ...full, roles: [{ characterId: A, role: "kill" }] }, labels, prices, A);
    expect(kill.header.roleLabel).toBe("Kill");
  });

  it("uses the active character's own role, not any other character's, when several were on it", () => {
    const other = 2112625428;
    const both = killmailView(
      { ...full, roles: [{ characterId: A, role: "loss" }, { characterId: other, role: "kill" }] },
      labels, prices, other);
    expect(both.header.roleLabel).toBe("Kill");
  });

  it("falls back to the computed value when zKillboard has none", () => {
    const computed = killmailView(
      { ...full, head: { ...full.head, zkbTotalValue: null } }, labels, prices, A);
    expect(computed.header.value).toBe("8.1M ISK");
  });

  it("builds the victim card", () => {
    expect(view.victim).toEqual({
      name: "TrilliumONE", corp: "Trill Industries", alliance: "Trill Alliance",
      portrait: "https://images.evetech.net/characters/669539978/portrait?size=128",
      shipTypeId: 621, shipName: "Caracal",
      shipRender: "https://images.evetech.net/types/621/render?size=128",
      damageTaken: "4,210",
    });
  });

  it("groups the items by slot in display order and values each row", () => {
    expect(view.slots.map((s) => s.slot)).toEqual(["high", "drone", "cargo"]);
    expect(view.slots[0]).toEqual({
      slot: "high", title: "High",
      rows: [{
        idx: 0, typeId: 3634, icon: "https://images.evetech.net/types/3634/icon?size=32",
        name: "Heavy Missile Launcher II", destroyed: "1", dropped: null,
        // 1 x 2,000,000 = 2,000,000.00 ISK
        value: "2,000,000.00 ISK", inContainer: null,
      }],
    });
    // 3 destroyed + 2 dropped = 5 Warrior II at 500,000 = 2,500,000.00 ISK
    expect(view.slots[1].rows[0]).toMatchObject({
      name: "Warrior II", destroyed: "3", dropped: "2", value: "2,500,000.00 ISK",
    });
    // The container's contents stay in the container's slot, tagged with its name.
    expect(view.slots[2].rows.map((r) => r.name)).toEqual(["Small Secure Container", "Tritanium"]);
    expect(view.slots[2].rows[1].inContainer).toBe("Small Secure Container");
    // 5000 x 5 = 25,000.00 ISK
    expect(view.slots[2].rows[1].value).toBe("25,000.00 ISK");
  });

  it("shows a dash for an item with no price", () => {
    const noPrice = killmailView(full, labels, new Map(), A);
    expect(noPrice.slots[0].rows[0].value).toBe("—");
  });

  it("sorts attackers by damage, marks the final blow and shows each one's share", () => {
    expect(view.attackers.map((a) => a.idx)).toEqual([1, 0]);
    expect(view.attackers[0]).toEqual({
      idx: 1, name: "—", corp: "—", alliance: null, ship: "—", shipTypeId: null, weapon: "—",
      // 3010 / 4210 = 0.71496… -> "71.5%"
      damage: "3,010", share: "71.5%", finalBlow: true, security: "0.0",
    });
    expect(view.attackers[1]).toMatchObject({
      name: "Bad Guy", corp: "Bad Corp", ship: "Rifter",
      weapon: "150mm Light AutoCannon II",
      // 1200 / 4210 = 0.28503… -> "28.5%"
      damage: "1,200", share: "28.5%", finalBlow: false, security: "-1.4",
    });
  });
});
