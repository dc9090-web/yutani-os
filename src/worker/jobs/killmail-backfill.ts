import type { GlobalSyncJob } from "../scheduler.js";
import { listCharacters } from "../../lib/db/characters.js";
import { saveKillmails } from "../../lib/db/killmails.js";
import {
  advanceBackfill, ensureBackfillRows, listUnfinishedBackfill, type BackfillCursor,
} from "../../lib/db/killmail-backfill.js";
import {
  partyIds, roleFor, toKillmailWrite,
  type CharacterKillmailLink, type KillmailWrite,
} from "../../lib/combat/killmail.js";
import {
  ZKB_MAX_PAGE, ZKB_PAGE_SIZE, createZkbClient, type ZkbKind, type ZkbRecord,
} from "../../lib/combat/zkb.js";
import { resolveNames } from "../../lib/names/index.js";
import { isAuthOrOutage } from "./resolve-guard.js";

export const BACKFILL_INTERVAL_MS = 15 * 60 * 1000;
export const BACKFILL_RETRY_MS = 5 * 60 * 1000;
/**
 * Spec §2's ruling: at most 20 pages per run, no parallelism, one request per 2 s — so a run costs
 * about 40 s of wall clock and zKillboard never sees a burst from us (Decision 6).
 *
 * Accepted: `src/worker/scheduler.ts`'s `tick()` runs every due job serially, one `await` at a time,
 * so this ~40 s of pacing blocks whatever character jobs are also due in the same 15-minute tick.
 * The delay is bounded (the pacing is capped, not open-ended) and self-corrects on the next tick —
 * not worth the complexity of running the backfill off the scheduler's own loop.
 */
export const MAX_BACKFILL_PAGES = 20;
/**
 * Decision 3: `resolveNames`'s own `NAMES_CHUNK = 1000` is just its internal ESI batching size, not
 * a limit a caller may rely on — a 20-page run can turn up far more than 1000 distinct ids. This is
 * the actual per-run cap the spec's "≤ 1000 ids" bound means: once `parties` reaches it, further
 * ids are simply not collected this run and are left for a later one to pick up.
 */
export const NAMES_PER_RUN_CAP = 1000;

export interface BackfillJobDeps {
  listCharacterIds: () => Promise<number[]>;
  ensureBackfillRows: (ids: number[]) => Promise<number>;
  listUnfinishedBackfill: () => Promise<BackfillCursor[]>;
  advanceBackfill: (
    characterId: number, kind: ZkbKind, next: { nextPage: number; done: boolean },
  ) => Promise<void>;
  fetchPage: (kind: ZkbKind, characterId: number, page: number) => Promise<ZkbRecord[]>;
  saveKillmails: (writes: KillmailWrite[], links: CharacterKillmailLink[]) => Promise<number>;
  resolveNames: (ids: number[]) => Promise<unknown>;
}

export function createKillmailBackfillJob(deps: BackfillJobDeps): GlobalSyncJob {
  return {
    name: "killmail-backfill",
    scope: "global",
    intervalMs: BACKFILL_INTERVAL_MS,
    retryMs: BACKFILL_RETRY_MS,
    async run(): Promise<number> {
      await deps.ensureBackfillRows(await deps.listCharacterIds());
      const cursors = await deps.listUnfinishedBackfill();

      let budget = MAX_BACKFILL_PAGES;
      let stored = 0;
      const parties = new Set<number>();

      for (const cursor of cursors) {
        let page = cursor.nextPage;
        let done = false;
        while (budget > 0 && !done) {
          // A throw here leaves next_page pointing at exactly the page that failed (spec §7):
          // the pages before it were advanced one at a time as they succeeded (Decision 7).
          const records = await deps.fetchPage(cursor.kind, cursor.characterId, page);
          budget -= 1;

          const writes: KillmailWrite[] = [];
          const links: CharacterKillmailLink[] = [];
          for (const record of records) {
            writes.push(toKillmailWrite(record, record.zkb.hash, "zkb", record.zkb));
            const role = roleFor(record, cursor.characterId)
              ?? (cursor.kind === "kills" ? "kill" : "loss");
            links.push({ characterId: cursor.characterId, killmailId: record.killmail_id, role });
            // Capped at NAMES_PER_RUN_CAP (Decision 3): the rest are simply not collected this run.
            for (const id of partyIds(record)) {
              if (parties.size < NAMES_PER_RUN_CAP) parties.add(id);
            }
          }
          stored += await deps.saveKillmails(writes, links);

          // A short page is the end of the character's history; page 100 is zKillboard's ceiling.
          done = records.length < ZKB_PAGE_SIZE || page >= ZKB_MAX_PAGE;
          const nextPage = done && page >= ZKB_MAX_PAGE ? page : page + 1;
          await deps.advanceBackfill(cursor.characterId, cursor.kind, { nextPage, done });
          page = nextPage;
        }
        if (budget === 0) break;
      }

      if (parties.size > 0) {
        try {
          await deps.resolveNames([...parties]);
        } catch (e) {
          if (isAuthOrOutage(e)) throw e;
          console.warn(`[killmail-backfill] name resolution failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      return stored;
    },
  };
}

const zkb = createZkbClient();

export const killmailBackfillJob: GlobalSyncJob = createKillmailBackfillJob({
  listCharacterIds: async () => (await listCharacters()).map((c) => c.id),
  ensureBackfillRows,
  listUnfinishedBackfill,
  advanceBackfill,
  fetchPage: (kind, characterId, page) => zkb.fetchPage(kind, characterId, page),
  saveKillmails,
  resolveNames,
});
