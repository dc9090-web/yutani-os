import type { EsiClient } from "../lib/esi/client.js";
import { NeedsReauthError } from "../lib/esi/tokens.js";
import type { startRun, finishRun } from "../lib/db/sync-runs.js";

export interface JobContext { characterId: number; esi: EsiClient }
export interface SyncJob { name: string; intervalMs: number; run(ctx: JobContext): Promise<number> }
export interface SchedulerDeps {
  jobs: SyncJob[]; esi: EsiClient; listCharacters: () => Promise<{ id: number; tokenStatus: string }[]>;
  startRun: typeof startRun; finishRun: typeof finishRun; now?: () => number; staggerMs?: number; log?: (msg: string) => void;
}

export class Scheduler {
  private due = new Map<string, number>();   // `${job}:${cid}` → next due time
  private now: () => number; private stagger: number; private log: (m: string) => void;
  constructor(private deps: SchedulerDeps) {
    this.now = deps.now ?? Date.now; this.stagger = deps.staggerMs ?? 5000; this.log = deps.log ?? ((m) => console.log(`[worker] ${m}`));
  }

  async tick(): Promise<number> {
    const chars = (await this.deps.listCharacters()).filter((c) => c.tokenStatus === "ok");
    let ran = 0, slot = 0;
    for (const job of this.deps.jobs) {
      for (const c of chars) {
        const key = `${job.name}:${c.id}`;
        if (!this.due.has(key)) this.due.set(key, this.now() + slot * this.stagger);
        slot++;
      }
    }
    for (const job of this.deps.jobs) {
      for (const c of chars) {
        const key = `${job.name}:${c.id}`;
        if (this.due.get(key)! > this.now()) continue;
        await this.runOne(job, c.id);
        this.due.set(key, this.now() + job.intervalMs);
        ran++;
      }
    }
    return ran;
  }

  private async runOne(job: SyncJob, characterId: number): Promise<void> {
    const id = await this.deps.startRun(job.name, characterId);
    try {
      const rows = await job.run({ characterId, esi: this.deps.esi });
      await this.deps.finishRun(id, { status: "ok", rows });
      this.log(`${job.name} character=${characterId} ok rows=${rows}`);
    } catch (e) {
      const error = e instanceof NeedsReauthError ? e.message : (e as Error).message ?? String(e);
      await this.deps.finishRun(id, { status: "error", error });
      this.log(`${job.name} character=${characterId} error: ${error}`);
    }
  }
}
