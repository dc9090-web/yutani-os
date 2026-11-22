import { duration, grouped, sp } from "./format.js";

/**
 * "160.00M" / "1.24B" / "12.5k" / "950" — a wallet total short enough for a headline figure. The
 * unit ("ISK") is set beside it by the caller. Per-character balances stay exact.
 */
export function iskCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return grouped(Math.round(value));
}

export interface OverviewSummaryInput {
  name: string;
  /** null until the wallet job has run for this character. */
  balance: number | null;
  /** null until the skills job has run. */
  totalSp: number | null;
  /** When the skill at the head of the live queue finishes; null when the queue is empty or paused. */
  headFinish: Date | null;
}

export interface OverviewSummary {
  /** null when no character has a wallet yet. */
  wallet: string | null;
  totalSp: string | null;
  queuesActive: number;
  queuesTotal: number;
  /** The skill that completes soonest across all the characters shown. */
  next: { time: string; name: string } | null;
}

/**
 * The Overview's summary strip (redesign hand-off, PAGES.md §1): combined wallet, total skill
 * points, training queues active, and the next skill to complete. All of it is a fold over the same
 * rows the character cards are drawn from. A queue counts as active when its head has a finish date
 * still in the future.
 */
export function overviewSummary(rows: readonly OverviewSummaryInput[], now: Date): OverviewSummary {
  const balances = rows.flatMap((r) => (r.balance === null ? [] : [r.balance]));
  const points = rows.flatMap((r) => (r.totalSp === null ? [] : [r.totalSp]));
  const training = rows
    .flatMap((r) => (r.headFinish !== null && r.headFinish.getTime() > now.getTime() ? [{ name: r.name, finish: r.headFinish }] : []))
    .sort((a, b) => a.finish.getTime() - b.finish.getTime());
  return {
    wallet: balances.length === 0 ? null : iskCompact(balances.reduce((sum, b) => sum + b, 0)),
    totalSp: points.length === 0 ? null : sp(points.reduce((sum, p) => sum + p, 0), false),
    queuesActive: training.length,
    queuesTotal: rows.length,
    next: training.length === 0 ? null : { time: duration(training[0].finish.getTime() - now.getTime()), name: training[0].name },
  };
}
