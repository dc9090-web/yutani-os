import { describe, it, expect, vi } from "vitest";
import {
  createKillmailsJob, killmailsJob, redactKillmailHash, KILLMAILS_INTERVAL_MS, KILLMAILS_RETRY_MS,
  KILLMAILS_SCOPE, MAX_KILLMAIL_PAGES, type EsiKillmailRef, type KillmailsJobDeps,
} from "../../src/worker/jobs/killmails.js";
import type { CharacterKillmailLink, EsiKillmail, KillmailWrite } from "../../src/lib/combat/killmail.js";
import { EsiError } from "../../src/lib/esi/client.js";
import { esiFixture } from "../fixtures/esi.js";

const CID = 669539978;
const body = (id: number): EsiKillmail => ({ ...esiFixture<EsiKillmail>("killmail"), killmail_id: id });
const ref = (id: number): EsiKillmailRef => ({ killmail_id: id, killmail_hash: `hash-${id}` });

type Call = { path: string; characterId: number | undefined; page: number | undefined };

function harness(opts: {
  scopes?: string[]; pages?: EsiKillmailRef[][]; known?: number[];
  listError?: unknown; listErrorAtPage?: number;
  bodyError?: (path: string) => unknown;
} = {}) {
  const pages = opts.pages ?? [[ref(120000001), ref(120000002)], []];
  const calls: Call[] = [];
  const writes: KillmailWrite[] = [];
  const links: CharacterKillmailLink[] = [];
  const resolved: number[][] = [];
  const deps: KillmailsJobDeps = {
    getCharacter: async () => ({ scopes: opts.scopes ?? [KILLMAILS_SCOPE] }),
    knownKillmailIds: async () => new Set(opts.known ?? []),
    saveKillmails: async (w, l) => { writes.push(...w); links.push(...l); return w.length + l.length; },
    resolveNames: async (ids) => { resolved.push(ids); return new Map(); },
  };
  const esi = {
    get: vi.fn(async (path: string, o?: { characterId?: number; page?: number }) => {
      calls.push({ path, characterId: o?.characterId, page: o?.page });
      if (path.includes("/killmails/recent")) {
        // `listErrorAtPage` lets a test fail only page N, so pages before it can be checked as
        // having been fetched, stored and reported rather than discarded by the 403 branch.
        if (opts.listError !== undefined
            && (opts.listErrorAtPage === undefined || o?.page === opts.listErrorAtPage)) {
          throw opts.listError;
        }
        return { data: pages[(o?.page ?? 1) - 1] ?? [] };
      }
      if (opts.bodyError !== undefined) throw opts.bodyError(path);
      const id = Number(path.split("/")[2]);
      return { data: body(id) };
    }),
  };
  return { job: createKillmailsJob(deps), esi, calls, writes, links, resolved };
}

describe("killmails job", () => {
  it("is an hourly character job that retries in ten minutes", () => {
    expect(killmailsJob.name).toBe("killmails");
    expect(killmailsJob.scope ?? "character").toBe("character");
    expect(killmailsJob.intervalMs).toBe(KILLMAILS_INTERVAL_MS);
    expect(KILLMAILS_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(killmailsJob.retryMs).toBe(KILLMAILS_RETRY_MS);
    expect(KILLMAILS_RETRY_MS).toBe(10 * 60 * 1000);
    expect(MAX_KILLMAIL_PAGES).toBe(10);
  });

  it("walks pages, fetches each unknown body publicly and stores it with a role", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(4);
    expect(h.calls).toEqual([
      { path: `/characters/${CID}/killmails/recent`, characterId: CID, page: 1 },
      { path: "/killmails/120000001/hash-120000001", characterId: undefined, page: undefined },
      { path: "/killmails/120000002/hash-120000002", characterId: undefined, page: undefined },
      { path: `/characters/${CID}/killmails/recent`, characterId: CID, page: 2 },
    ]);
    expect(h.writes.map((w) => w.killmail.killmailId)).toEqual([120000001, 120000002]);
    expect(h.writes[0].killmail.source).toBe("esi");
    expect(h.writes[0].killmail.killmailHash).toBe("hash-120000001");
    // The fixture's victim IS our character, so both are losses.
    expect(h.links).toEqual([
      { characterId: CID, killmailId: 120000001, role: "loss" },
      { characterId: CID, killmailId: 120000002, role: "loss" },
    ]);
  });

  it("stops at the first page whose ids are all already stored", async () => {
    const h = harness({
      pages: [[ref(1), ref(2)], [ref(3), ref(4)], [ref(5)]],
      known: [3, 4],
    });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    const listPages = h.calls.filter((c) => c.path.includes("recent")).map((c) => c.page);
    expect(listPages).toEqual([1, 2]);
    expect(h.writes.map((w) => w.killmail.killmailId)).toEqual([1, 2]);
  });

  it("never walks past MAX_KILLMAIL_PAGES", async () => {
    const pages = Array.from({ length: 20 }, (_, i) => [ref(1000 + i)]);
    const h = harness({ pages });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.calls.filter((c) => c.path.includes("recent"))).toHaveLength(MAX_KILLMAIL_PAGES);
  });

  it("resolves every victim, attacker, corporation and alliance id exactly once", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolved).toHaveLength(1);
    expect([...h.resolved[0]].sort((a, b) => a - b)).toEqual(
      [98000001, 98000002, 99000001, 99000002, 669539978, 2112625428, 2124678472].sort((a, b) => a - b));
  });

  it("returns 0 without calling ESI when the character has not granted the scope", async () => {
    const h = harness({ scopes: [] });
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.calls).toEqual([]);
  });

  it("degrades a 403 to a warning so the run still counts as ok", async () => {
    const h = harness({ listError: new EsiError(403, "/killmails/recent", "ESI 403") });
    const outcome = await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(outcome).toEqual({
      rows: 0,
      warn: "killmail scope not on this token yet — log the character in again (ESI 403)",
    });
  });

  it("saves the pages fetched before a later page's 403, and reports what was saved", async () => {
    const h = harness({
      pages: [[ref(120000001)], [ref(120000002)]],
      listError: new EsiError(403, "/killmails/recent", "ESI 403"),
      listErrorAtPage: 2,
    });
    const outcome = await h.job.run({ characterId: CID, esi: h.esi as never });
    // Page 1's one killmail + its one loss link = 2, from the fake saveKillmails above.
    expect(outcome).toEqual({
      rows: 2,
      warn: "killmail scope not on this token yet — log the character in again (ESI 403)",
    });
    expect(h.writes.map((w) => w.killmail.killmailId)).toEqual([120000001]);
    expect(h.links).toEqual([{ characterId: CID, killmailId: 120000001, role: "loss" }]);
  });

  it("lets a 401 propagate so the scheduler can mark the token for re-authorisation", async () => {
    const h = harness({ listError: new EsiError(401, "/killmails/recent", "ESI 401") });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toThrow(/401/);
  });

  it("keeps the killmails it stored when name resolution fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = harness();
    const job = createKillmailsJob({
      getCharacter: async () => ({ scopes: [KILLMAILS_SCOPE] }),
      knownKillmailIds: async () => new Set(),
      saveKillmails: async (w, l) => w.length + l.length,
      resolveNames: async () => { throw new Error("names are down"); },
    });
    expect(await job.run({ characterId: CID, esi: h.esi as never })).toBe(4);
    warn.mockRestore();
  });

  it("strips the killmail hash from a failing body fetch's error before it propagates", async () => {
    const h = harness({
      pages: [[ref(120000001)], []],
      bodyError: (path) => new EsiError(500, path, `ESI 500 for ${path}: server error`),
    });
    let caught: unknown;
    try {
      await h.job.run({ characterId: CID, esi: h.esi as never });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EsiError);
    const message = (caught as Error).message;
    expect(message).toContain("120000001");
    expect(message).not.toContain("hash-120000001");
    expect(message).toContain("<hash>");
  });

  it("redactKillmailHash leaves a non-EsiError and an error with no hash in it alone", () => {
    const plain = new Error("not an esi error, has hash-120000001 in it too");
    expect(redactKillmailHash(plain, "hash-120000001")).toBe(plain);
    expect(plain.message).toContain("hash-120000001");

    const noHash = new EsiError(500, "/killmails/1/h", "ESI 500 for /killmails/1/h: oops");
    const original = noHash.message;
    expect((redactKillmailHash(noHash, "hash-not-present") as Error).message).toBe(original);
  });
});
