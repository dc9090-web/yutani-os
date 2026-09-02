import { describe, it, expect } from "vitest";
import {
  COMBAT_PERIODS, DEFAULT_PERIOD, MONTHS_SHOWN, PERIOD_LABELS, TOP_N,
  combatStats, parsePeriod, periodStart, type StatRow,
} from "../../src/lib/combat/stats.js";

const NOW = new Date("2026-09-02T00:00:00Z");

/**
 * Five rows, chosen so every figure in spec §5 has a different answer:
 *   1  kill  2026-09-01  150,000,000  Jita 30000142  we flew 621, weapon 2929, final blow
 *   2  kill  2026-08-15   50,000,000  Jita 30000142  we flew 621, weapon 2929, final blow, solo
 *   3  loss  2026-07-04  200,000,000  Amarr 30002187 we lost 621
 *   4  kill  2025-10-20   25,000,000  30000144       we flew 11393, weapon 3025
 *   5  kill  2026-09-01    5,000,000  Jita 30000142  we flew 621, weapon 2929
 */
const rows: StatRow[] = [
  { killmailId: 1, role: "kill", time: new Date("2026-09-01T12:00:00Z"), value: 150_000_000,
    solarSystemId: 30000142, victimShipTypeId: 587, ourShipTypeId: 621, weaponTypeId: 2929,
    solo: false, finalBlow: true },
  { killmailId: 2, role: "kill", time: new Date("2026-08-15T09:00:00Z"), value: 50_000_000,
    solarSystemId: 30000142, victimShipTypeId: 590, ourShipTypeId: 621, weaponTypeId: 2929,
    solo: true, finalBlow: true },
  { killmailId: 3, role: "loss", time: new Date("2026-07-04T18:30:00Z"), value: 200_000_000,
    solarSystemId: 30002187, victimShipTypeId: 621, ourShipTypeId: 621, weaponTypeId: null,
    solo: false, finalBlow: false },
  { killmailId: 4, role: "kill", time: new Date("2025-10-20T03:00:00Z"), value: 25_000_000,
    solarSystemId: 30000144, victimShipTypeId: 587, ourShipTypeId: 11393, weaponTypeId: 3025,
    solo: false, finalBlow: false },
  { killmailId: 5, role: "kill", time: new Date("2026-09-01T20:00:00Z"), value: 5_000_000,
    solarSystemId: 30000142, victimShipTypeId: 587, ourShipTypeId: 621, weaponTypeId: 2929,
    solo: false, finalBlow: false },
];

describe("combatStats", () => {
  const stats = combatStats(rows, NOW);

  it("counts kills and losses and adds up the ISK on each side", () => {
    expect(stats.kills).toBe(4);
    expect(stats.losses).toBe(1);
    // 150,000,000 + 50,000,000 + 25,000,000 + 5,000,000 = 230,000,000
    expect(stats.iskDestroyed).toBe(230_000_000);
    expect(stats.iskLost).toBe(200_000_000);
  });

  it("computes efficiency as destroyed / (destroyed + lost)", () => {
    // 230,000,000 / 430,000,000 = 0.5348837209302325
    expect(stats.efficiency).toBeCloseTo(230 / 430, 12);
    expect((stats.efficiency! * 100).toFixed(1)).toBe("53.5");
  });

  it("has no efficiency at all when nothing has a value", () => {
    const blank = combatStats(
      rows.map((r) => ({ ...r, value: null })), NOW);
    expect(blank.iskDestroyed).toBe(0);
    expect(blank.iskLost).toBe(0);
    expect(blank.efficiency).toBeNull();
    expect(blank.kills).toBe(4);
  });

  it("counts solo kills and final blows on kills only", () => {
    expect(stats.soloKills).toBe(1);
    expect(stats.finalBlows).toBe(2);
  });

  it("ranks ships flown on kills, ships lost and systems, ties broken by ascending id", () => {
    expect(stats.shipsFlown).toEqual([{ id: 621, count: 3 }, { id: 11393, count: 1 }]);
    expect(stats.shipsLost).toEqual([{ id: 621, count: 1 }]);
    expect(stats.systems).toEqual([
      { id: 30000142, count: 3 }, { id: 30000144, count: 1 }, { id: 30002187, count: 1 },
    ]);
    expect(TOP_N).toBe(5);
  });

  it("keeps at most five entries in each top list", () => {
    const many: StatRow[] = Array.from({ length: 8 }, (_, i) => ({
      ...rows[0], killmailId: 100 + i, ourShipTypeId: 1000 + i, solarSystemId: 2000 + i,
    }));
    const wide = combatStats(many, NOW);
    expect(wide.shipsFlown).toHaveLength(TOP_N);
    expect(wide.systems).toHaveLength(TOP_N);
  });

  it("picks the weapon used on the most kills", () => {
    expect(stats.favouriteWeapon).toBe(2929);
    expect(combatStats([rows[2]], NOW).favouriteWeapon).toBeNull();
  });

  it("buckets twelve calendar months ending with the month of `now`", () => {
    expect(stats.months).toHaveLength(MONTHS_SHOWN);
    expect(MONTHS_SHOWN).toBe(12);
    expect(stats.months.map((m) => m.month)).toEqual([
      "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
      "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
    ]);
    // index 0 is the row from 2025-10-20; 9 is the July loss; 10 is August; 11 has two kills.
    expect(stats.months[0]).toEqual({ month: "2025-10", kills: 1, losses: 0 });
    expect(stats.months[9]).toEqual({ month: "2026-07", kills: 0, losses: 1 });
    expect(stats.months[10]).toEqual({ month: "2026-08", kills: 1, losses: 0 });
    expect(stats.months[11]).toEqual({ month: "2026-09", kills: 2, losses: 0 });
  });

  it("drops a row older than the twelve-month window from the strip but not from the totals", () => {
    const old: StatRow = { ...rows[0], killmailId: 9, time: new Date("2024-01-01T00:00:00Z") };
    const wide = combatStats([...rows, old], NOW);
    expect(wide.kills).toBe(5);
    expect(wide.months.reduce((n, m) => n + m.kills, 0)).toBe(4);
  });
});

describe("periods", () => {
  it("names the four tabs from spec §6", () => {
    expect(COMBAT_PERIODS).toEqual(["30d", "90d", "1y", "all"]);
    expect(PERIOD_LABELS).toEqual({ "30d": "30 d", "90d": "90 d", "1y": "1 y", all: "All" });
    expect(DEFAULT_PERIOD).toBe("90d");
  });
  it("falls back to the default for anything it does not recognise", () => {
    expect(parsePeriod("30d")).toBe("30d");
    expect(parsePeriod("all")).toBe("all");
    expect(parsePeriod(null)).toBe(DEFAULT_PERIOD);
    expect(parsePeriod("last-tuesday")).toBe(DEFAULT_PERIOD);
  });
  it("turns a period into the earliest instant it includes", () => {
    // 2026-09-02 minus 30 days is 2026-08-03; minus 90 is 2026-06-04; minus a year is 2025-09-02.
    expect(periodStart("30d", NOW)?.toISOString()).toBe("2026-08-03T00:00:00.000Z");
    expect(periodStart("90d", NOW)?.toISOString()).toBe("2026-06-04T00:00:00.000Z");
    expect(periodStart("1y", NOW)?.toISOString()).toBe("2025-09-02T00:00:00.000Z");
    expect(periodStart("all", NOW)).toBeNull();
  });
});
