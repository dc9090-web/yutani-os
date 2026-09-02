import type { EsiKillmail, ZkbBlock } from "./killmail.js";

/**
 * zKillboard's killmail query API (research §6). It publishes no numeric rate limit — only
 * etiquette — so this client is deliberately slow and deliberately serial: one request per
 * ZKB_PACE_MS, no parallelism, a descriptive User-Agent with a contact and a project URL, and
 * `Accept-Encoding: gzip`. The trailing slash is REQUIRED; without it requests silently fail.
 */
export const ZKB_BASE_URL = "https://zkillboard.com/api/";
/**
 * Spec §2 pins this string. It is deliberately NOT `config.esiUserAgent`: that value is
 * `EVE-Plasma/0.1 (dac9dc@gmail.com)`, with no project URL, which is exactly what zKillboard's
 * etiquette asks you not to send.
 */
export const ZKB_USER_AGENT = "EVE-plasma66/1.0 (dac9dc@gmail.com; +https://eve.plasma66.com)";
/** 200 killmails a page, pages 1..100 — 20,000 killmails per filter (verified, research §6). */
export const ZKB_PAGE_SIZE = 200;
export const ZKB_MAX_PAGE = 100;
/** Spec §2 ruling: one request per 2 s. Cost if it is too slow: a slower backfill. */
export const ZKB_PACE_MS = 2000;

export type ZkbKind = "kills" | "losses";
export interface ZkbRecord extends EsiKillmail { zkb: ZkbBlock }

/** Modifiers are path segments and the entity filter must come before `page` (research §6). */
export function zkbPageUrl(kind: ZkbKind, characterId: number, page: number): string {
  return `${ZKB_BASE_URL}${kind}/characterID/${characterId}/page/${page}/`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * `null` means "this is not a zKillboard page" — an HTML error document, a rate-limit JSON object,
 * a record with no usable hash. The job turns that into an error run and leaves its cursor alone.
 */
export function parseZkbPage(body: unknown): ZkbRecord[] | null {
  if (!Array.isArray(body)) return null;
  for (const row of body) {
    if (!isRecord(row)) return null;
    if (typeof row.killmail_id !== "number" || typeof row.killmail_time !== "string") return null;
    if (!isRecord(row.victim) || !Array.isArray(row.attackers)) return null;
    const zkb = row.zkb;
    if (!isRecord(zkb) || typeof zkb.hash !== "string" || zkb.hash.length === 0) return null;
  }
  return body as ZkbRecord[];
}

export interface ZkbClientDeps {
  fetchImpl?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>;
}
export interface ZkbClient {
  fetchPage(kind: ZkbKind, characterId: number, page: number): Promise<ZkbRecord[]>;
}

export function createZkbClient(deps: ZkbClientDeps = {}): ZkbClient {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let nextAllowedAt = 0;

  return {
    async fetchPage(kind, characterId, page) {
      const wait = nextAllowedAt - now();
      if (wait > 0) await sleep(wait);
      nextAllowedAt = now() + ZKB_PACE_MS;

      const url = zkbPageUrl(kind, characterId, page);
      const res = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "User-Agent": ZKB_USER_AGENT,
        },
      });
      const where = `${kind}/characterID/${characterId}/page/${page}/`;
      if (!res.ok) throw new Error(`zKillboard ${res.status} for ${where}`);
      const parsed = parseZkbPage(await res.json().catch(() => null));
      if (parsed === null) throw new Error(`zKillboard returned a malformed page for ${where}`);
      return parsed;
    },
  };
}
