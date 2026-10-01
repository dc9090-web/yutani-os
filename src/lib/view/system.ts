import type { SyncRunSummary } from "../db/sync-runs.js";

/** One readout state for the system strip under the header (design hand-back 2026-10-01). */
export type SystemReadout = "ok" | "error" | "running" | "none";

export interface SystemState { sync: SystemReadout; esi: SystemReadout }

/**
 * Folds the latest run per job into one readout: running beats error beats ok, and `none` when
 * nothing has run at all. A `warn: ` partial success is still `ok` (the row is marked ok).
 */
function fold(runs: readonly SyncRunSummary[]): SystemReadout {
  if (runs.length === 0) return "none";
  if (runs.some((r) => r.status === "running")) return "running";
  if (runs.some((r) => r.status === "error")) return "error";
  return "ok";
}

/**
 * `sync` covers every job; `esi` only the character-scoped ones, which are the jobs that talk to
 * ESI — the SDE import and market-price pulls are global and say nothing about ESI.
 */
export function systemState(runs: readonly SyncRunSummary[]): SystemState {
  return { sync: fold(runs), esi: fold(runs.filter((r) => r.characterId !== null)) };
}
