import { EsiClient, EsiError } from "../lib/esi/client.js";
import { NeedsReauthError } from "../lib/esi/tokens.js";
import type { startRun, finishRun } from "../lib/db/sync-runs.js";
import { WARN_PREFIX } from "../lib/view/format.js";

export interface JobContext { characterId: number; esi: EsiClient }
export interface GlobalJobContext { esi: EsiClient }

/**
 * What a job's `run` may return. A bare number is "everything worked, this many rows"; the object
 * form adds a non-fatal warning — the run still counts as `ok` and still waits the full interval,
 * but the message is written to `sync_runs.error` behind `WARN_PREFIX` so `/settings` can show it
 * (spec §3: a Fuzzwork outage degrades prices, it does not fail the run).
 */
export interface JobOutcome { rows: number; warn?: string }

/** A job run once per character. `scope` may be omitted — that is what a character job looks like. */
export interface CharacterSyncJob {
  name: string;
  scope?: "character";
  intervalMs: number;
  /** When set, a failed run is rebooked at now + retryMs instead of now + intervalMs. */
  retryMs?: number;
  run(ctx: JobContext): Promise<number | JobOutcome>;
}

/** A job run once per interval regardless of characters; its sync_runs rows have character_id NULL. */
export interface GlobalSyncJob {
  name: string;
  scope: "global";
  intervalMs: number;
  /** When set, a failed run is rebooked at now + retryMs instead of now + intervalMs. */
  retryMs?: number;
  run(ctx: GlobalJobContext): Promise<number | JobOutcome>;
}

export type SyncJob = CharacterSyncJob | GlobalSyncJob;

export interface SchedulerDeps {
  jobs: SyncJob[]; esi: EsiClient; listCharacters: () => Promise<{ id: number; tokenStatus: string }[]>;
  startRun: typeof startRun; finishRun: typeof finishRun; now?: () => number; staggerMs?: number; log?: (msg: string) => void;
  markNeedsReauth?: (characterId: number) => Promise<void>;
}

function isGlobal(job: SyncJob): job is GlobalSyncJob {
  return job.scope === "global";
}

export class Scheduler {
  private due = new Map<string, number>();   // `${job}:${cid|global}` → next due time
  private now: () => number; private stagger: number; private log: (m: string) => void;
  constructor(private deps: SchedulerDeps) {
    this.now = deps.now ?? Date.now; this.stagger = deps.staggerMs ?? 5000; this.log = deps.log ?? ((m) => console.log(`[worker] ${m}`));
  }

  async tick(): Promise<number> {
    const chars = (await this.deps.listCharacters()).filter((c) => c.tokenStatus === "ok");
    const globalJobs = this.deps.jobs.filter(isGlobal);
    const characterJobs = this.deps.jobs.filter((j): j is CharacterSyncJob => !isGlobal(j));

    // Stagger only applies to character jobs; a global job is due the moment it is first seen.
    let slot = 0;
    for (const job of characterJobs) {
      for (const c of chars) {
        const key = `${job.name}:${c.id}`;
        if (!this.due.has(key)) this.due.set(key, this.now() + slot * this.stagger);
        slot++;
      }
    }
    for (const job of globalJobs) {
      const key = `${job.name}:global`;
      if (!this.due.has(key)) this.due.set(key, this.now());
    }

    let ran = 0;
    for (const job of globalJobs) {
      const key = `${job.name}:global`;
      if (this.due.get(key)! > this.now()) continue;
      const outcome = await this.record(job.name, null, () => job.run({ esi: this.deps.esi }));
      const delay = outcome === "error" && job.retryMs !== undefined ? job.retryMs : job.intervalMs;
      this.due.set(key, this.now() + delay);
      ran++;
    }
    for (const job of characterJobs) {
      for (const c of chars) {
        const key = `${job.name}:${c.id}`;
        if (this.due.get(key)! > this.now()) continue;
        const outcome = await this.record(job.name, c.id, () => job.run({ characterId: c.id, esi: this.deps.esi }));
        const delay = outcome === "error" && job.retryMs !== undefined ? job.retryMs : job.intervalMs;
        this.due.set(key, this.now() + delay);
        ran++;
      }
    }
    return ran;
  }

  private async record(name: string, characterId: number | null, exec: () => Promise<number | JobOutcome>): Promise<"ok" | "error"> {
    const who = characterId === null ? "global" : `character=${characterId}`;
    const id = await this.deps.startRun(name, characterId);
    try {
      const outcome = await exec();
      const { rows, warn } = typeof outcome === "number" ? { rows: outcome, warn: undefined } : outcome;
      const error = warn === undefined ? undefined : `${WARN_PREFIX}${warn}`;
      await this.deps.finishRun(id, { status: "ok", rows, error });
      this.log(`${name} ${who} ok rows=${rows}${error === undefined ? "" : ` (${error})`}`);
      return "ok";
    } catch (e) {
      let error: string;
      if (e instanceof NeedsReauthError) {
        error = e.message;
      } else if (e instanceof EsiError && e.status === 401 && characterId !== null) {
        await this.deps.markNeedsReauth?.(characterId);
        error = "ESI 401 — token rejected; character needs re-authorisation";
      } else {
        error = (e as Error).message ?? String(e);
      }
      await this.deps.finishRun(id, { status: "error", error });
      this.log(`${name} ${who} error: ${error}`);
      return "error";
    }
  }
}
