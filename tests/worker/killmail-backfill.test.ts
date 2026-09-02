import { describe, it, expect, vi } from "vitest";
import {
  BACKFILL_INTERVAL_MS, BACKFILL_RETRY_MS, MAX_BACKFILL_PAGES, NAMES_PER_RUN_CAP,
  createKillmailBackfillJob, killmailBackfillJob, type BackfillJobDeps,
} from "../../src/worker/jobs/killmail-backfill.js";
import type { BackfillCursor } from "../../src/lib/db/killmail-backfill.js";
import type { ZkbRecord } from "../../src/lib/combat/zkb.js";
import type { CharacterKillmailLink, KillmailWrite } from "../../src/lib/combat/killmail.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fixture = (): ZkbRecord[] =>
  JSON.parse(readFileSync(path.join(dir, "../fixtures/zkb/kills-page.json"), "utf8")) as ZkbRecord[];

const A = 669539978;

/** A full page: the fixture's first record repeated 200 times with distinct ids (Decision 15). */
function fullPage(base: number): ZkbRecord[] {
  const template = fixture()[0];
  return Array.from({ length: 200 }, (_, i) => ({ ...template, killmail_id: base + i }));
}

function harness(opts: {
  cursors?: BackfillCursor[];
  pages?: (kind: string, characterId: number, page: number) => ZkbRecord[] | Error;
  unresolvedPartyIds?: (limit: number) => Promise<number[]>;
} = {}) {
  const cursors = opts.cursors ?? [
    { characterId: A, kind: "kills", nextPage: 1, done: false, updatedAt: new Date(0) },
  ];
  const advanced: { characterId: number; kind: string; nextPage: number; done: boolean }[] = [];
  const fetched: { kind: string; characterId: number; page: number }[] = [];
  const writes: KillmailWrite[] = [];
  const links: CharacterKillmailLink[] = [];
  const resolved: number[][] = [];
  const deps: BackfillJobDeps = {
    listCharacterIds: async () => [A],
    ensureBackfillRows: async () => 0,
    listUnfinishedBackfill: async () => cursors,
    advanceBackfill: async (characterId, kind, next) => { advanced.push({ characterId, kind, ...next }); },
    fetchPage: async (kind, characterId, page) => {
      fetched.push({ kind, characterId, page });
      const out = opts.pages?.(kind, characterId, page) ?? fixture();
      if (out instanceof Error) throw out;
      return out;
    },
    saveKillmails: async (w, l) => { writes.push(...w); links.push(...l); return w.length; },
    resolveNames: async (ids) => { resolved.push(ids); return new Map(); },
    unresolvedPartyIds: opts.unresolvedPartyIds ?? (async () => []),
  };
  return { job: createKillmailBackfillJob(deps), advanced, fetched, writes, links, resolved };
}

describe("killmail-backfill job", () => {
  it("is a global 15-minute job that retries in five", () => {
    expect(killmailBackfillJob.name).toBe("killmail-backfill");
    expect(killmailBackfillJob.scope).toBe("global");
    expect(killmailBackfillJob.intervalMs).toBe(BACKFILL_INTERVAL_MS);
    expect(BACKFILL_INTERVAL_MS).toBe(15 * 60 * 1000);
    expect(killmailBackfillJob.retryMs).toBe(BACKFILL_RETRY_MS);
    expect(BACKFILL_RETRY_MS).toBe(5 * 60 * 1000);
    expect(MAX_BACKFILL_PAGES).toBe(20);
  });

  it("stores a short page with source zkb, the zkb hash and the kind's role, then marks it done", async () => {
    const h = harness();
    expect(await h.job.run({ esi: undefined as never })).toBe(3);
    expect(h.fetched).toEqual([{ kind: "kills", characterId: A, page: 1 }]);
    expect(h.writes.map((w) => w.killmail.killmailId)).toEqual([110000001, 110000002, 110000003]);
    expect(h.writes[0].killmail.source).toBe("zkb");
    expect(h.writes[0].killmail.killmailHash).toBe("349571831ca127c015bc34050b4c02b29927827d");
    expect(h.writes[0].killmail.zkbTotalValue).toBe(60633419.79);
    expect(h.links.every((l) => l.role === "kill")).toBe(true);
    // 3 records < ZKB_PAGE_SIZE (200), so the cursor is finished.
    expect(h.advanced).toEqual([{ characterId: A, kind: "kills", nextPage: 2, done: true }]);
  });

  it("keeps walking while pages are full and stops at the run's twenty-page budget", async () => {
    const h = harness({ pages: (_k, _c, page) => fullPage(page * 1000) });
    await h.job.run({ esi: undefined as never });
    expect(h.fetched.map((f) => f.page)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(h.advanced.at(-1)).toEqual({ characterId: A, kind: "kills", nextPage: 21, done: false });
  });

  it("hands the rest of the budget to the next cursor when one finishes", async () => {
    const h = harness({
      cursors: [
        { characterId: A, kind: "kills", nextPage: 1, done: false, updatedAt: new Date(0) },
        { characterId: A, kind: "losses", nextPage: 5, done: false, updatedAt: new Date(1) },
      ],
    });
    await h.job.run({ esi: undefined as never });
    expect(h.fetched).toEqual([
      { kind: "kills", characterId: A, page: 1 },
      { kind: "losses", characterId: A, page: 5 },
    ]);
    expect(h.advanced).toEqual([
      { characterId: A, kind: "kills", nextPage: 2, done: true },
      { characterId: A, kind: "losses", nextPage: 6, done: true },
    ]);
  });

  it("finishes a cursor that reaches page 100 even on a full page", async () => {
    const h = harness({
      cursors: [{ characterId: A, kind: "kills", nextPage: 100, done: false, updatedAt: new Date(0) }],
      pages: () => fullPage(500000),
    });
    await h.job.run({ esi: undefined as never });
    expect(h.fetched).toEqual([{ kind: "kills", characterId: A, page: 100 }]);
    expect(h.advanced).toEqual([{ characterId: A, kind: "kills", nextPage: 100, done: true }]);
  });

  it("leaves the failing page's cursor untouched and lets the error reach the scheduler", async () => {
    const h = harness({
      pages: (_k, _c, page) => (page === 1 ? fullPage(1) : new Error("zKillboard 503 for kills")),
    });
    await expect(h.job.run({ esi: undefined as never })).rejects.toThrow(/503/);
    // Page 1 was stored and advanced; page 2 threw and left next_page at 2 (Decision 7).
    expect(h.advanced).toEqual([{ characterId: A, kind: "kills", nextPage: 2, done: false }]);
  });

  it("returns 0 and calls nothing when every cursor is finished", async () => {
    const h = harness({ cursors: [] });
    expect(await h.job.run({ esi: undefined as never })).toBe(0);
    expect(h.fetched).toEqual([]);
  });

  it("caps the ids collected for name resolution at NAMES_PER_RUN_CAP per run", async () => {
    // Each record's victim is a distinct character id, so a full 20-page run turns up 4,000
    // candidate ids — far more than resolveNames should ever be asked to chase in one call
    // (Decision 3, corrected: NAMES_CHUNK is resolveNames' own batching size, not a caller bound).
    const partyPage = (page: number): ZkbRecord[] => {
      const template = fixture()[0];
      return Array.from({ length: 200 }, (_, i) => ({
        ...template,
        killmail_id: page * 1000 + i,
        victim: { ...template.victim, character_id: 800_000_000 + page * 1000 + i },
      }));
    };
    const h = harness({ pages: (_k, _c, page) => partyPage(page) });
    await h.job.run({ esi: undefined as never });
    expect(h.resolved).toHaveLength(1);
    expect(h.resolved[0]).toHaveLength(NAMES_PER_RUN_CAP);
  });

  it("sweeps ids an earlier run's cap dropped, even when this run fetches no pages", async () => {
    // Every cursor is already done, so the page loop collects nothing this run — but a stored
    // killmail from an earlier run still has an id with no universe_names row.
    const h = harness({
      cursors: [],
      unresolvedPartyIds: async (limit) => {
        expect(limit).toBe(NAMES_PER_RUN_CAP);
        return [800_000_001];
      },
    });
    await h.job.run({ esi: undefined as never });
    expect(h.resolved).toEqual([[800_000_001]]);
  });

  it("does not let the sweep push a run's ids past NAMES_PER_RUN_CAP", async () => {
    // The page loop alone already fills the cap, so there is no remaining budget for the sweep —
    // it must not be called at all, let alone push the total past the cap.
    const partyPage = (page: number): ZkbRecord[] => {
      const template = fixture()[0];
      return Array.from({ length: 200 }, (_, i) => ({
        ...template,
        killmail_id: page * 1000 + i,
        victim: { ...template.victim, character_id: 800_000_000 + page * 1000 + i },
      }));
    };
    let sweepCalled = false;
    const h = harness({
      pages: (_k, _c, page) => partyPage(page),
      unresolvedPartyIds: async () => { sweepCalled = true; return [999_999_999]; },
    });
    await h.job.run({ esi: undefined as never });
    expect(sweepCalled).toBe(false);
    expect(h.resolved[0]).toHaveLength(NAMES_PER_RUN_CAP);
    expect(h.resolved[0]).not.toContain(999_999_999);
  });
});
