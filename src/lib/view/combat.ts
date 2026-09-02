import type { CombatRow } from "../db/killmails.js";
import type { BackfillStatus } from "../db/killmail-backfill.js";
import type { CombatStats, TopEntry } from "../combat/stats.js";
import { grouped, secClass, secText, stamp } from "./format.js";
import { iskShort } from "./price.js";

const DASH = "—";

/**
 * Every label the combat pages need, already read out of Postgres. `names` is `universe_names`
 * (written by the jobs — Decision 3), `types` and `systems` are the SDE. A miss is a placeholder,
 * never an ESI call.
 */
export interface Labels {
  names: ReadonlyMap<number, string>;
  types: ReadonlyMap<number, string>;
  systems: ReadonlyMap<number, { name: string; security: number | null }>;
}

export function nameOf(id: number | null, labels: Labels): string {
  if (id === null) return DASH;
  return labels.names.get(id) ?? `ID ${id}`;
}
export function typeOf(id: number | null, labels: Labels): string {
  if (id === null) return DASH;
  return labels.types.get(id) ?? `Unknown (${id})`;
}

export interface KillmailRowView {
  killmailId: number; href: string; time: string; role: "kill" | "loss"; roleLabel: string;
  victimShipTypeId: number | null; victimShip: string; victim: string; victimCorp: string;
  system: string; secClass: string; secText: string;
  value: string; attackers: string; ourShip: string;
}

export function killmailRows(rows: CombatRow[], labels: Labels): KillmailRowView[] {
  return rows.map((row) => {
    const system = row.solarSystemId === null ? undefined : labels.systems.get(row.solarSystemId);
    const security = system?.security ?? null;
    return {
      killmailId: row.killmailId,
      href: `/combat/${row.killmailId}`,
      time: stamp(row.time),
      role: row.role,
      roleLabel: row.role === "kill" ? "Kill" : "Loss",
      victimShipTypeId: row.victimShipTypeId,
      victimShip: typeOf(row.victimShipTypeId, labels),
      victim: nameOf(row.victimCharacterId, labels),
      victimCorp: nameOf(row.victimCorporationId, labels),
      system: system?.name
        ?? (row.solarSystemId === null ? DASH : `Unknown system (${row.solarSystemId})`),
      secClass: system === undefined ? "sec-null" : secClass(security),
      secText: system === undefined ? DASH : secText(security),
      value: row.value === null ? DASH : iskShort(row.value),
      attackers: grouped(row.attackerCount),
      ourShip: typeOf(row.ourShipTypeId, labels),
    };
  });
}

export interface StatTile { key: string; label: string; value: string }

/** Spec §6's six tiles, in the order they are shown. */
export function statTiles(stats: CombatStats): StatTile[] {
  return [
    { key: "kills", label: "Kills", value: grouped(stats.kills) },
    { key: "losses", label: "Losses", value: grouped(stats.losses) },
    { key: "efficiency", label: "Efficiency",
      value: stats.efficiency === null ? DASH : `${(stats.efficiency * 100).toFixed(1)}%` },
    { key: "destroyed", label: "ISK destroyed", value: iskShort(stats.iskDestroyed) },
    { key: "lost", label: "ISK lost", value: iskShort(stats.iskLost) },
    { key: "solo", label: "Solo kills", value: grouped(stats.soloKills) },
  ];
}

export interface MonthBarView {
  month: string; label: string; kills: number; losses: number;
  killPct: number; lossPct: number; title: string;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * The twelve-column strip (spec §6): kills up, losses down, both scaled against the busiest single
 * count anywhere in the year so the tallest bar is always 100%. No chart library — the page turns
 * these percentages into CSS heights.
 */
export function monthBars(stats: CombatStats): MonthBarView[] {
  const peak = Math.max(0, ...stats.months.map((m) => Math.max(m.kills, m.losses)));
  const pct = (n: number): number => (peak === 0 ? 0 : Math.round((n / peak) * 100));
  return stats.months.map((m) => ({
    month: m.month,
    label: MONTH_ABBR[Number(m.month.slice(5, 7)) - 1],
    kills: m.kills, losses: m.losses,
    killPct: pct(m.kills), lossPct: pct(m.losses),
    title: `${m.month}: ${plural(m.kills, "kill", "kills")}, ${plural(m.losses, "loss", "losses")}`,
  }));
}

export interface TopListView { key: string; title: string; rows: { label: string; count: string }[] }

function list(
  key: string, title: string, entries: TopEntry[], label: (id: number) => string,
): TopListView {
  return { key, title, rows: entries.map((e) => ({ label: label(e.id), count: grouped(e.count) })) };
}

export function topLists(stats: CombatStats, labels: Labels): TopListView[] {
  return [
    list("flown", "Ships flown", stats.shipsFlown, (id) => typeOf(id, labels)),
    list("lost", "Ships lost", stats.shipsLost, (id) => typeOf(id, labels)),
    list("systems", "Systems", stats.systems,
      (id) => labels.systems.get(id)?.name ?? `Unknown system (${id})`),
  ];
}

/**
 * Spec §6's status line. `imported` is a count of linked killmails, not a stored counter
 * (Decision 8), and the per-kind cursors are summarised so the reader can see progress.
 */
export function backfillLine(status: BackfillStatus[]): string | null {
  const cursors = status.flatMap((s) => s.cursors);
  if (cursors.length === 0) return null;
  const imported = grouped(status.reduce((n, s) => n + s.imported, 0));
  if (cursors.every((c) => c.done)) {
    return `Backfill from zKillboard: complete — ${imported} killmails imported`;
  }
  const byKind = ["kills", "losses"].map((kind) => {
    const rows = cursors.filter((c) => c.kind === kind);
    if (rows.length === 0) return null;
    if (rows.every((c) => c.done)) return `${kind} done`;
    return `${kind} page ${Math.min(...rows.filter((c) => !c.done).map((c) => c.nextPage))}`;
  }).filter((s): s is string => s !== null);
  return `Backfill from zKillboard: ${imported} killmails imported (${byKind.join(", ")})`;
}
