import { describe, it, expect, vi } from "vitest";
import {
  KILLMAIL_VALUES_INTERVAL_MS, KILLMAIL_VALUES_RETRY_MS,
  createKillmailValuesJob, killmailValuesJob, type KillmailValuesDeps,
} from "../../src/worker/jobs/killmail-values.js";
import type { KillmailValueParts } from "../../src/lib/combat/value.js";
import type { Price } from "../../src/lib/view/price.js";

const price = (sell: number | null, adjusted: number | null): Price => ({ sell, buy: null, adjusted });

function harness(parts: KillmailValueParts[], prices: [number, Price][]) {
  const asked: number[][] = [];
  const written: { killmailId: number; value: number }[] = [];
  const touched: number[][] = [];
  let pruneCalls = 0;
  const deps: KillmailValuesDeps = {
    unvaluedKillmails: async () => parts,
    getPrices: async (ids) => { asked.push(ids); return new Map(prices); },
    setComputedValues: async (rows) => { written.push(...rows); return rows.length; },
    touchValueChecked: async (ids) => { touched.push(ids); return ids.length; },
    pruneKillmailCache: async () => { pruneCalls += 1; return 0; },
  };
  return {
    job: createKillmailValuesJob(deps), asked, written, touched,
    get pruneCalls() { return pruneCalls; },
  };
}

describe("killmail-values job", () => {
  it("is a global hourly job that retries in ten minutes", () => {
    expect(killmailValuesJob.name).toBe("killmail-values");
    expect(killmailValuesJob.scope).toBe("global");
    expect(killmailValuesJob.intervalMs).toBe(KILLMAIL_VALUES_INTERVAL_MS);
    expect(KILLMAIL_VALUES_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(killmailValuesJob.retryMs).toBe(KILLMAIL_VALUES_RETRY_MS);
    expect(KILLMAIL_VALUES_RETRY_MS).toBe(10 * 60 * 1000);
  });

  it("asks for every type once, writes what it could value and stamps the rest as checked", async () => {
    const h = harness(
      [
        { killmailId: 1, shipTypeId: 587, items: [{ typeId: 34, quantity: 1000 }] },
        { killmailId: 2, shipTypeId: 621, items: [{ typeId: 9999, quantity: 1 }] },
      ],
      [[587, price(8_000_000, null)], [34, price(5, null)], [621, price(30_000_000, null)]]);
    // Killmail 1: 8,000,000 + 1000 x 5 = 8,005,000. Killmail 2: type 9999 has no price -> skipped.
    expect(await h.job.run({ esi: undefined as never })).toBe(1);
    expect(h.written).toEqual([{ killmailId: 1, value: 8_005_000 }]);
    expect([...h.asked[0]].sort((a, b) => a - b)).toEqual([34, 587, 621, 9999]);
    // Killmail 2 was examined but not priced: value_checked_at is stamped so it is not re-selected
    // for 24h (starvation guard), even though it never got a value.
    expect(h.touched).toEqual([[2]]);
    expect(h.pruneCalls).toBe(1);
  });

  it("returns 0 and asks for nothing when every killmail is already valued", async () => {
    const h = harness([], []);
    expect(await h.job.run({ esi: undefined as never })).toBe(0);
    expect(h.asked).toEqual([]);
    expect(h.written).toEqual([]);
    expect(h.touched).toEqual([]);
    // The cache prune runs every tick regardless of whether there was anything to value.
    expect(h.pruneCalls).toBe(1);
  });
});
