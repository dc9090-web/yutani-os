import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ZKB_BASE_URL, ZKB_MAX_PAGE, ZKB_PACE_MS, ZKB_PAGE_SIZE, ZKB_USER_AGENT,
  createZkbClient, parseZkbPage, zkbPageUrl, type ZkbRecord,
} from "../../src/lib/combat/zkb.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const page = (): ZkbRecord[] =>
  JSON.parse(readFileSync(path.join(dir, "../fixtures/zkb/kills-page.json"), "utf8")) as ZkbRecord[];

const CID = 669539978;

describe("zkbPageUrl", () => {
  it("puts the page modifier after the entity filter and ends with a slash", () => {
    expect(zkbPageUrl("kills", CID, 1)).toBe(`${ZKB_BASE_URL}kills/characterID/${CID}/page/1/`);
    expect(zkbPageUrl("losses", CID, 17)).toBe(`${ZKB_BASE_URL}losses/characterID/${CID}/page/17/`);
    expect(ZKB_BASE_URL).toBe("https://zkillboard.com/api/");
  });
  it("pins the etiquette constants from spec §2", () => {
    expect(ZKB_USER_AGENT).toBe("EVE-plasma66/1.0 (dac9dc@gmail.com; +https://eve.plasma66.com)");
    expect(ZKB_PAGE_SIZE).toBe(200);
    expect(ZKB_MAX_PAGE).toBe(100);
    expect(ZKB_PACE_MS).toBe(2000);
  });
});

describe("parseZkbPage", () => {
  it("accepts a real page and keeps the zkb block", () => {
    const rows = parseZkbPage(page())!;
    expect(rows).toHaveLength(3);
    expect(rows[0].killmail_id).toBe(110000001);
    expect(rows[0].zkb.hash).toBe("349571831ca127c015bc34050b4c02b29927827d");
    expect(rows[0].zkb.totalValue).toBe(60633419.79);
    expect(rows[2].victim.character_id).toBeUndefined();
  });
  it("accepts an empty page", () => {
    expect(parseZkbPage([])).toEqual([]);
  });
  it("rejects anything that is not an array of killmails with a hash", () => {
    expect(parseZkbPage(null)).toBeNull();
    expect(parseZkbPage({ error: "Rate limited" })).toBeNull();
    expect(parseZkbPage([{ killmail_id: 1 }])).toBeNull();
    expect(parseZkbPage([{ killmail_id: 1, killmail_time: "x", victim: {}, attackers: [], zkb: {} }])).toBeNull();
  });
});

describe("createZkbClient", () => {
  function harness(responses: { status: number; body: unknown }[]) {
    let clock = 0;
    const slept: number[] = [];
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      seen.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
      const next = responses.shift() ?? { status: 200, body: [] };
      return {
        ok: next.status >= 200 && next.status < 300, status: next.status,
        json: async () => next.body,
      } as unknown as Response;
    });
    const client = createZkbClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => clock,
      sleep: async (ms) => { slept.push(ms); clock += ms; },
    });
    return { client, fetchImpl, seen, slept, tick: (ms: number) => { clock += ms; } };
  }

  it("sends the descriptive User-Agent and asks for gzip", async () => {
    const h = harness([{ status: 200, body: page() }]);
    const rows = await h.client.fetchPage("kills", CID, 1);
    expect(rows).toHaveLength(3);
    expect(h.seen[0].url).toBe(`${ZKB_BASE_URL}kills/characterID/${CID}/page/1/`);
    expect(h.seen[0].headers["User-Agent"]).toBe(ZKB_USER_AGENT);
    expect(h.seen[0].headers["Accept-Encoding"]).toBe("gzip");
    expect(h.seen[0].headers.Accept).toBe("application/json");
  });

  it("paces requests two seconds apart, counting time that has already passed", async () => {
    const h = harness([{ status: 200, body: [] }, { status: 200, body: [] }, { status: 200, body: [] }]);
    await h.client.fetchPage("kills", CID, 1);      // clock 0, no wait, next allowed at 2000
    expect(h.slept).toEqual([]);
    h.tick(500);                                    // clock 500
    await h.client.fetchPage("kills", CID, 2);      // waits 2000 - 500 = 1500, clock 2000
    expect(h.slept).toEqual([1500]);
    h.tick(5000);                                   // clock 7000, well past 4000
    await h.client.fetchPage("kills", CID, 3);      // no wait needed
    expect(h.slept).toEqual([1500]);
  });

  it("throws with the page in the message on a non-200", async () => {
    const h = harness([{ status: 503, body: null }]);
    await expect(h.client.fetchPage("losses", CID, 4)).rejects.toThrow(
      `zKillboard 503 for losses/characterID/${CID}/page/4/`);
  });

  it("throws on a malformed page rather than storing rubbish", async () => {
    const h = harness([{ status: 200, body: { error: "nope" } }]);
    await expect(h.client.fetchPage("kills", CID, 1)).rejects.toThrow(/malformed/);
  });
});
