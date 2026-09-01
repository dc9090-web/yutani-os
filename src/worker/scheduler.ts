import { EsiClient, EsiError } from "../lib/esi/client.js";
import { NeedsReauthError } from "../lib/esi/tokens.js";
import type { startRun, finishRun } from "../lib/db/sync-runs.js";

export interface JobContext { characterId: number; esi: EsiClient }
export interface GlobalJobContext { esi: EsiClient }

/** A job run once per character. `scope` may be omitted — that is what a character job looks like. */
export interface CharacterSyncJob {
  name: string;
  scope?: "character";
  intervalMs: number;
  run(ctx: JobContext): Promise<number>;
}

/** A job run once per interval regardless of characters; its sync_runs rows have character_id NULL. */
export interface GlobalSyncJob {
  name: string;
  scope: "global";
  intervalMs: number;
  run(ctx: GlobalJobContext): Promise<number>;
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
      await this.record(job.name, null, () => job.run({ esi: this.deps.esi }));
      this.due.set(key, this.now() + job.intervalMs);
      ran++;
    }
    for (const job of characterJobs) {
      for (const c of chars) {
        const key = `${job.name}:${c.id}`;
        if (this.due.get(key)! > this.now()) continue;
        await this.record(job.name, c.id, () => job.run({ characterId: c.id, esi: this.deps.esi }));
        this.due.set(key, this.now() + job.intervalMs);
        ran++;
      }
    }
    return ran;
  }

  private async record(name: string, characterId: number | null, exec: () => Promise<number>): Promise<void> {
    const who = characterId === null ? "global" : `character=${characterId}`;
    const id = await this.deps.startRun(name, characterId);
    try {
      const rows = await exec();
      await this.deps.finishRun(id, { status: "ok", rows });
      this.log(`${name} ${who} ok rows=${rows}`);
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
    }
  }
}
