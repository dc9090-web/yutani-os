import { describe, it, expect } from "vitest";
import {
  backfillLine, killmailRows, monthBars, nameOf, statTiles, statsTruncationNote, topLists, typeOf,
  type Labels,
} from "../../src/lib/view/combat.js";
import { combatStats, type StatRow } from "../../src/lib/combat/stats.js";
import type { CombatRow } from "../../src/lib/db/killmails.js";

const NOW = new Date("2026-09-02T00:00:00Z");

const labels: Labels = {
  names: new Map([[669539978, "TrilliumONE"], [98000001, "Trill Industries"]]),
  types: new Map([[621, "Caracal"], [587, "Rifter"], [2929, "150mm Light AutoCannon II"]]),
  systems: new Map([[30000142, { name: "Jita", security: 0.946 }],
                    [30002187, { name: "Amarr", security: 1.0 }]]),
};

const row: CombatRow = {
  killmailId: 120000001, role: "loss", time: new Date("2026-09-01T12:00:00Z"), value: 8_125_000,
  solarSystemId: 30000142, victimCharacterId: 669539978, victimCorporationId: 98000001,
  victimShipTypeId: 621, ourShipTypeId: 621, weaponTypeId: null,
  solo: false, finalBlow: false, attackerCount: 3,
};

describe("nameOf / typeOf", () => {
  it("falls back to a readable placeholder rather than crashing", () => {
    expect(nameOf(669539978, labels)).toBe("TrilliumONE");
    expect(nameOf(4242, labels)).toBe("ID 4242");
    expect(nameOf(null, labels)).toBe("—");
    expect(typeOf(621, labels)).toBe("Caracal");
    expect(typeOf(4242, labels)).toBe("Unknown (4242)");
    expect(typeOf(null, labels)).toBe("—");
  });
});

describe("killmailRows", () => {
  it("renders one table row", () => {
    expect(killmailRows([row], labels)).toEqual([{
      killmailId: 120000001, href: "/combat/120000001", time: "2026-09-01 12:00",
      role: "loss", roleLabel: "Loss",
      victimShipTypeId: 621, victimShip: "Caracal",
      victim: "TrilliumONE", victimCorp: "Trill Industries",
      system: "Jita", secClass: "sec-high", secText: "0.9",
      // iskShort(8,125,000) = (8.125).toFixed(1) = "8.1M ISK"
      value: "8.1M ISK", attackers: "3", ourShip: "Caracal",
    }]);
  });
  it("shows a dash for an unvalued killmail and for a structure loss with no victim character", () => {
    const [view] = killmailRows(
      [{ ...row, value: null, victimCharacterId: null, ourShipTypeId: null }], labels);
    expect(view.value).toBe("—");
    expect(view.victim).toBe("—");
    expect(view.ourShip).toBe("—");
  });
  it("labels a kill", () => {
    expect(killmailRows([{ ...row, role: "kill" }], labels)[0].roleLabel).toBe("Kill");
  });
});

describe("statTiles", () => {
  const rows: StatRow[] = [
    { killmailId: 1, role: "kill", time: new Date("2026-09-01T12:00:00Z"), value: 230_000_000,
      solarSystemId: 30000142, victimShipTypeId: 587, ourShipTypeId: 621, weaponTypeId: 2929,
      solo: true, finalBlow: true },
    { killmailId: 2, role: "loss", time: new Date("2026-08-15T09:00:00Z"), value: 200_000_000,
      solarSystemId: 30002187, victimShipTypeId: 621, ourShipTypeId: 621, weaponTypeId: null,
      solo: false, finalBlow: false },
  ];
  it("shows the six tiles from spec §6 in order", () => {
    // 230,000,000 / 430,000,000 = 0.5348837… -> "53.5%"; iskShort(230,000,000) = "230.0M ISK".
    expect(statTiles(combatStats(rows, NOW))).toEqual([
      { key: "kills", label: "Kills", value: "1" },
      { key: "losses", label: "Losses", value: "1" },
      { key: "efficiency", label: "Efficiency", value: "53.5%" },
      { key: "destroyed", label: "ISK destroyed", value: "230.0M ISK" },
      { key: "lost", label: "ISK lost", value: "200.0M ISK" },
      { key: "solo", label: "Solo kills", value: "1" },
    ]);
  });
  it("shows a dash for efficiency when nothing is valued yet", () => {
    const blank = combatStats(rows.map((r) => ({ ...r, value: null })), NOW);
    expect(statTiles(blank)[2]).toEqual({ key: "efficiency", label: "Efficiency", value: "—" });
  });
});

describe("monthBars", () => {
  const rows: StatRow[] = [
    { killmailId: 1, role: "kill", time: new Date("2026-09-01T12:00:00Z"), value: 1,
      solarSystemId: null, victimShipTypeId: null, ourShipTypeId: null, weaponTypeId: null,
      solo: false, finalBlow: false },
    { killmailId: 2, role: "kill", time: new Date("2026-09-02T12:00:00Z"), value: 1,
      solarSystemId: null, victimShipTypeId: null, ourShipTypeId: null, weaponTypeId: null,
      solo: false, finalBlow: false },
    { killmailId: 3, role: "loss", time: new Date("2026-08-15T12:00:00Z"), value: 1,
      solarSystemId: null, victimShipTypeId: null, ourShipTypeId: null, weaponTypeId: null,
      solo: false, finalBlow: false },
  ];
  it("scales every bar against the busiest month", () => {
    const bars = monthBars(combatStats(rows, NOW));
    expect(bars).toHaveLength(12);
    expect(bars[11]).toEqual({
      month: "2026-09", label: "Sep", kills: 2, losses: 0,
      killPct: 100, lossPct: 0, title: "2026-09: 2 kills, 0 losses",
    });
    // The tallest column is September's 2, so August's single loss is 1 / 2 = 50%.
    expect(bars[10]).toEqual({
      month: "2026-08", label: "Aug", kills: 0, losses: 1,
      killPct: 0, lossPct: 50, title: "2026-08: 0 kills, 1 loss",
    });
    expect(bars[0].label).toBe("Oct");
    expect(bars[0].killPct).toBe(0);
  });
  it("leaves every bar at zero when there is no activity at all", () => {
    const bars = monthBars(combatStats([], NOW));
    expect(bars.every((b) => b.killPct === 0 && b.lossPct === 0)).toBe(true);
  });
});

describe("topLists", () => {
  it("names ships and systems and pluralises the counts", () => {
    const rows: StatRow[] = [
      { killmailId: 1, role: "kill", time: NOW, value: 1, solarSystemId: 30000142,
        victimShipTypeId: 587, ourShipTypeId: 621, weaponTypeId: 2929, solo: false, finalBlow: false },
      { killmailId: 2, role: "loss", time: NOW, value: 1, solarSystemId: 30002187,
        victimShipTypeId: 587, ourShipTypeId: 587, weaponTypeId: null, solo: false, finalBlow: false },
    ];
    const lists = topLists(combatStats(rows, NOW), labels);
    expect(lists.map((l) => l.key)).toEqual(["flown", "lost", "systems"]);
    expect(lists[0]).toEqual({ key: "flown", title: "Ships flown", rows: [{ label: "Caracal", count: "1" }] });
    expect(lists[1]).toEqual({ key: "lost", title: "Ships lost", rows: [{ label: "Rifter", count: "1" }] });
    expect(lists[2].rows).toEqual([{ label: "Jita", count: "1" }, { label: "Amarr", count: "1" }]);
  });
});

describe("backfillLine", () => {
  it("reports the total imported and the page still to fetch", () => {
    expect(backfillLine([{
      characterId: 1, imported: 3200,
      cursors: [{ kind: "kills", nextPage: 17, done: false }, { kind: "losses", nextPage: 4, done: true }],
    }])).toBe("Backfill from zKillboard: 3,200 killmails imported (kills page 17, losses done)");
  });
  it("says so once every cursor is finished", () => {
    expect(backfillLine([{
      characterId: 1, imported: 12,
      cursors: [{ kind: "kills", nextPage: 3, done: true }, { kind: "losses", nextPage: 2, done: true }],
    }])).toBe("Backfill from zKillboard: complete — 12 killmails imported");
  });
  it("is null before the job has ever run", () => {
    expect(backfillLine([])).toBeNull();
    expect(backfillLine([{ characterId: 1, imported: 0, cursors: [] }])).toBeNull();
  });
});

describe("statsTruncationNote", () => {
  it("notes the cap when the statistics rowset hit it", () => {
    expect(statsTruncationNote(true)).toBe("Statistics cover the most recent 20,000 killmails");
  });
  it("is null otherwise", () => {
    expect(statsTruncationNote(false)).toBeNull();
  });
});
