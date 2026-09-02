import type { GlobalSyncJob } from "../scheduler.js";
import { getPrices } from "../../lib/db/market-prices.js";
import {
  pruneKillmailCache, setComputedValues, touchValueChecked, unvaluedKillmails,
} from "../../lib/db/killmail-values.js";
import { computeKillmailValue, type KillmailValueParts } from "../../lib/combat/value.js";
import type { Price } from "../../lib/view/price.js";

export const KILLMAIL_VALUES_INTERVAL_MS = 60 * 60 * 1000;
export const KILLMAIL_VALUES_RETRY_MS = 10 * 60 * 1000;

export interface KillmailValuesDeps {
  unvaluedKillmails: (limit?: number) => Promise<KillmailValueParts[]>;
  getPrices: (typeIds: number[]) => Promise<Map<number, Price>>;
  setComputedValues: (rows: { killmailId: number; value: number }[]) => Promise<number>;
  touchValueChecked: (killmailIds: number[]) => Promise<number>;
  pruneKillmailCache: () => Promise<number>;
}

/**
 * Spec §4: one pass over the killmails `unvaluedKillmails` offers (least-recently-checked first —
 * the starvation guard), one price query for every type they mention together, and a write for each
 * killmail whose types were all priced. Every id this run looked at is stamped with
 * `value_checked_at`, whether or not it got a value: `setComputedValues` stamps the priced ones as
 * part of the same write, and `touchValueChecked` stamps the rest, so an unpriceable killmail is not
 * re-offered for 24 hours instead of starving the batch behind it every single run.
 */
export function createKillmailValuesJob(deps: KillmailValuesDeps): GlobalSyncJob {
  return {
    name: "killmail-values",
    scope: "global",
    intervalMs: KILLMAIL_VALUES_INTERVAL_MS,
    retryMs: KILLMAIL_VALUES_RETRY_MS,
    async run(): Promise<number> {
      // Killmail-body esi_cache rows are write-once-never-read; this is unrelated to valuation but
      // hourly is the natural cadence for it, so it rides along on this job's tick.
      await deps.pruneKillmailCache();

      const parts = await deps.unvaluedKillmails();
      if (parts.length === 0) return 0;

      const typeIds = new Set<number>();
      for (const p of parts) {
        if (p.shipTypeId !== null) typeIds.add(p.shipTypeId);
        for (const item of p.items) typeIds.add(item.typeId);
      }
      const prices = await deps.getPrices([...typeIds]);

      const valued: { killmailId: number; value: number }[] = [];
      const unpriced: number[] = [];
      for (const p of parts) {
        const value = computeKillmailValue(p, prices);
        if (value !== null) valued.push({ killmailId: p.killmailId, value });
        else unpriced.push(p.killmailId);
      }
      const [written] = await Promise.all([
        deps.setComputedValues(valued),
        deps.touchValueChecked(unpriced),
      ]);
      return written;
    },
  };
}

export const killmailValuesJob: GlobalSyncJob = createKillmailValuesJob({
  unvaluedKillmails, getPrices, setComputedValues, touchValueChecked, pruneKillmailCache,
});
