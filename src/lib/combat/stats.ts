import type { KillRole } from "./killmail.js";

/**
 * Spec §5's statistics as a pure function. Everything is derived from the rows the caller passes,
 * including the twelve-month strip, so the same code answers the page, a test and (later) an API
 * route without a database anywhere near it.
 */
export type CombatPeriod = "30d" | "90d" | "1y" | "all";
export const COMBAT_PERIODS: readonly CombatPeriod[] = ["30d", "90d", "1y", "all"];
export const PERIOD_LABELS: Record<CombatPeriod, string> = {
  "30d": "30 d", "90d": "90 d", "1y": "1 y", all: "All",
};
/** ESI's own recent window, and the one period where every killmail is certain to be complete. */
export const DEFAULT_PERIOD: CombatPeriod = "90d";
export const TOP_N = 5;
export const MONTHS_SHOWN = 12;

export function parsePeriod(raw: string | null | undefined): CombatPeriod {
  return COMBAT_PERIODS.includes(raw as CombatPeriod) ? (raw as CombatPeriod) : DEFAULT_PERIOD;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** `null` = no lower bound, which is what "All" means to the SQL. */
export function periodStart(period: CombatPeriod, now: Date): Date | null {
  switch (period) {
    case "30d": return new Date(now.getTime() - 30 * DAY_MS);
    case "90d": return new Date(now.getTime() - 90 * DAY_MS);
    case "1y": {
      const start = new Date(now.getTime());
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      return start;
    }
    default: return null;
  }
}

export interface StatRow {
  killmailId: number; role: KillRole; time: Date; value: number | null;
  solarSystemId: number | null; victimShipTypeId: number | null;
  ourShipTypeId: number | null; weaponTypeId: number | null;
  solo: boolean; finalBlow: boolean;
}
export interface TopEntry { id: number; count: number }
export interface MonthBucket { month: string; kills: number; losses: number }
export interface CombatStats {
  kills: number; losses: number; iskDestroyed: number; iskLost: number;
  efficiency: number | null; soloKills: number; finalBlows: number;
  shipsFlown: TopEntry[]; shipsLost: TopEntry[]; systems: TopEntry[];
  favouriteWeapon: number | null; months: MonthBucket[];
}

/** Highest count first, ties broken by ascending id so the list never reorders itself. */
function top(counts: Map<number, number>, limit = TOP_N): TopEntry[] {
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => (b.count - a.count) || (a.id - b.id))
    .slice(0, limit);
}

function bump(counts: Map<number, number>, id: number | null): void {
  if (id === null) return;
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

/** "2026-09" — UTC, zero-padded, sortable, and what the strip's labels are derived from. */
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function combatStats(rows: StatRow[], now: Date): CombatStats {
  let kills = 0;
  let losses = 0;
  let iskDestroyed = 0;
  let iskLost = 0;
  let soloKills = 0;
  let finalBlows = 0;
  const shipsFlown = new Map<number, number>();
  const shipsLost = new Map<number, number>();
  const systems = new Map<number, number>();
  const weapons = new Map<number, number>();

  // The twelve buckets exist whether or not anything happened in them, so the strip is never ragged.
  const months: MonthBucket[] = [];
  const monthIndex = new Map<string, number>();
  for (let back = MONTHS_SHOWN - 1; back >= 0; back--) {
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const key = monthKey(cursor);
    monthIndex.set(key, months.length);
    months.push({ month: key, kills: 0, losses: 0 });
  }

  for (const row of rows) {
    const value = row.value ?? 0;      // an unvalued killmail counts as an event, not as ISK
    if (row.role === "kill") {
      kills += 1;
      iskDestroyed += value;
      if (row.solo) soloKills += 1;
      if (row.finalBlow) finalBlows += 1;
      bump(shipsFlown, row.ourShipTypeId);
      bump(weapons, row.weaponTypeId);
    } else {
      losses += 1;
      iskLost += value;
      bump(shipsLost, row.victimShipTypeId);
    }
    bump(systems, row.solarSystemId);
    const slot = monthIndex.get(monthKey(row.time));
    if (slot !== undefined) {
      if (row.role === "kill") months[slot].kills += 1; else months[slot].losses += 1;
    }
  }

  const totalIsk = iskDestroyed + iskLost;
  return {
    kills, losses, iskDestroyed, iskLost,
    efficiency: totalIsk === 0 ? null : iskDestroyed / totalIsk,
    soloKills, finalBlows,
    shipsFlown: top(shipsFlown), shipsLost: top(shipsLost), systems: top(systems),
    favouriteWeapon: top(weapons, 1)[0]?.id ?? null,
    months,
  };
}
