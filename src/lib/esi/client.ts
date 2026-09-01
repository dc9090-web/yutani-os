import type { AppConfig } from "../config.js";
import type { getCached, putCached } from "../db/esi-cache.js";

export interface EsiDeps {
  fetchImpl?: typeof fetch; getAccessToken: (characterId: number) => Promise<string>;
  cache: { get: typeof getCached; put: typeof putCached };
  config: Pick<AppConfig, "esiBaseUrl" | "esiCompatibilityDate" | "esiUserAgent">;
  now?: () => number; sleep?: (ms: number) => Promise<void>; timeoutMs?: number;
}
export interface EsiResult<T> { data: T; status: number; pages: number; fromCache: boolean; lastModified: string | null }
export class EsiError extends Error {
  constructor(public status: number, public path: string, message: string) { super(message); this.name = "EsiError"; }
}
/**
 * ESI answered 502/503/504 within the last minute. 5xx responses cost 0 rate-limit tokens but
 * DO consume the global error limit (verified), so a retry-happy worker during a Tranquility
 * outage gets itself 420'd. The breaker fails every call fast until the window passes; the
 * scheduler records the error and the next interval retries.
 */
export class EsiUnavailableError extends EsiError {
  constructor(path: string, public retryAtMs: number) {
    super(503, path, `ESI is unavailable; not calling again until ${new Date(retryAtMs).toISOString()}`);
    this.name = "EsiUnavailableError";
  }
}
interface GetOpts { characterId?: number; query?: Record<string, string | number>; page?: number; fresh?: boolean }
interface PostOpts { characterId?: number; query?: Record<string, string | number> }

const HALT_MS = 60_000;
const THROTTLE_FRACTION = 0.2;
export const ERROR_LIMIT_FLOOR = 20;   // X-ESI-Error-Limit-Remain below this → wait for the reset
export const OUTAGE_MS = 60_000;       // breaker window after any 502/503/504

/** "150/15m" → { tokens: 150, windowMs: 900000 } */
export function parseLimit(v: string | null): { tokens: number; windowMs: number } | null {
  const m = /^(\d+)\/(\d+)([smh])$/.exec(v ?? "");
  if (!m) return null;
  const unit = { s: 1000, m: 60_000, h: 3_600_000 }[m[3] as "s" | "m" | "h"];
  return { tokens: Number(m[1]), windowMs: Number(m[2]) * unit };
}

/**
 * `/characters/123/wallet/journal` → `/characters/{id}/wallet/journal`.
 * ESI announces the rate-limit group per route, so remembering it against the route *template*
 * means the first call for a new character already knows which bucket it belongs to.
 */
export function routeTemplate(pathname: string): string {
  return pathname.replace(/\/\d+/g, "/{id}");
}

export class EsiClient {
  private fetchImpl: typeof fetch; private now: () => number; private sleep: (ms: number) => Promise<void>; private timeoutMs: number;
  private haltUntil = 0;
  private unavailableUntil = 0;        // breaker: no request leaves the process before this time
  private errorLimitWaitUntil = 0;     // X-ESI-Error-Limit-Remain fell below the floor
  private groupWait = new Map<string, number>();   // `${group}:${characterId}` → time when it is OK to call again
  private pathGroup = new Map<string, string>();   // route template → rate-limit group

  constructor(private deps: EsiDeps) {
    this.fetchImpl = deps.fetchImpl ?? fetch; this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.timeoutMs = deps.timeoutMs ?? 30_000;
  }

  async get<T>(path: string, opts: GetOpts = {}): Promise<EsiResult<T>> {
    const cid = opts.characterId ?? 0;
    const url = this.buildUrl(path, opts.query);
    if (opts.page) url.searchParams.set("page", String(opts.page));
    const key = url.pathname + url.search;

    const cached = await this.deps.cache.get(cid, key);
    if (!opts.fresh && cached?.expiresAt && cached.expiresAt.getTime() > this.now()) {
      return { data: cached.body as T, status: 200, pages: cached.pages, fromCache: true, lastModified: cached.lastModified };
    }

    const headers = await this.headers(opts.characterId);
    if (cached?.etag) headers["If-None-Match"] = cached.etag;
    const res = await this.request(url, key, cid, () => ({ headers, signal: AbortSignal.timeout(this.timeoutMs) }));

    const pages = Number(res.headers.get("X-Pages") ?? cached?.pages ?? 1) || 1;
    const expiresAt = parseHttpDate(res.headers.get("Expires"));

    if (res.status === 304 && cached) {
      const lastModified = res.headers.get("Last-Modified") ?? cached.lastModified;
      await this.deps.cache.put(cid, key, { ...cached, expiresAt: expiresAt ?? cached.expiresAt, pages, lastModified });
      return { data: cached.body as T, status: 304, pages, fromCache: true, lastModified };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new EsiError(res.status, key, `ESI ${res.status} for ${key}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as T;
    const lastModified = res.headers.get("Last-Modified");
    await this.deps.cache.put(cid, key, { etag: res.headers.get("ETag"), expiresAt, pages, body: data, lastModified });
    return { data, status: res.status, pages, fromCache: false, lastModified };
  }

  /**
   * ESI's docs: every page of one paginated resource carries the same `Last-Modified`. A page that
   * disagrees means the data refreshed mid-walk and the assembled set is torn — discard it and walk
   * again, this time bypassing any still-valid cached page so every page is re-fetched from the
   * network (with `If-None-Match` still sent) instead of reusing a cached body that may already be
   * stale relative to what a torn page 2 just revealed. Still torn → the caller gets a 409.
   *
   * `esi_cache.last_modified` is what makes a cache hit able to take part in this comparison at
   * all; rows written before that column existed read back as NULL, which this code treats the
   * same as "ESI sent no Last-Modified" — the comparison is skipped once for that row and it
   * self-heals as soon as the row is next written by a real network response.
   */
  async getAll<T>(path: string, opts: Omit<GetOpts, "page" | "fresh"> = {}): Promise<T[]> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const rows = await this.walk<T>(path, { ...opts, fresh: attempt > 0 });
      if (rows) return rows;
    }
    throw new EsiError(409, this.buildUrl(path, opts.query).pathname, "paginated resource changed mid-walk");
  }

  /** One pass over the pages; `null` when a page's Last-Modified disagrees with page 1's. */
  private async walk<T>(path: string, opts: Omit<GetOpts, "page">): Promise<T[] | null> {
    const first = await this.get<T[]>(path, { ...opts, page: 1 });
    const out = [...first.data];
    for (let p = 2; p <= first.pages; p++) {
      const next = await this.get<T[]>(path, { ...opts, page: p });
      if (first.lastModified && next.lastModified && next.lastModified !== first.lastModified) return null;
      out.push(...next.data);
    }
    return out;
  }

  /**
   * JSON POST. ESI's POST routes carry no cache headers at all, so nothing is read from or
   * written to `esi_cache`; callers impose their own TTL and chunk bodies to <= 1000 unique IDs.
   */
  async post<T>(path: string, body: unknown, opts: PostOpts = {}): Promise<T> {
    const cid = opts.characterId ?? 0;
    const url = this.buildUrl(path, opts.query);
    const key = url.pathname + url.search;
    const headers = await this.headers(opts.characterId);
    headers["Content-Type"] = "application/json";
    const payload = JSON.stringify(body);
    const res = await this.request(url, key, cid, () => ({
      method: "POST", headers, body: payload, signal: AbortSignal.timeout(this.timeoutMs),
    }));
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new EsiError(res.status, key, `ESI ${res.status} for POST ${key}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  private buildUrl(path: string, query?: Record<string, string | number>): URL {
    const url = new URL(path, this.deps.config.esiBaseUrl);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));
    return url;
  }

  private async headers(characterId?: number): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: "application/json", "User-Agent": this.deps.config.esiUserAgent,
      "X-Compatibility-Date": this.deps.config.esiCompatibilityDate,
    };
    if (characterId) headers.Authorization = `Bearer ${await this.deps.getAccessToken(characterId)}`;
    return headers;
  }

  /** Shared pre/post-flight for every HTTP call: breaker, budget waits, one 429 retry, 420 halt, 5xx breaker. */
  private async request(url: URL, key: string, characterId: number, makeInit: () => RequestInit): Promise<Response> {
    if (this.unavailableUntil > this.now()) throw new EsiUnavailableError(key, this.unavailableUntil);
    await this.waitForBudget(url.pathname, characterId);
    let res = await this.fetchImpl(url, makeInit());
    this.noteLimits(url.pathname, characterId, res);
    if (res.status === 429) {
      const retry = Number(res.headers.get("Retry-After") ?? "5");
      await this.sleep(retry * 1000);
      res = await this.fetchImpl(url, makeInit());
      this.noteLimits(url.pathname, characterId, res);
    }
    if (res.status === 420) {
      this.haltUntil = this.now() + HALT_MS;
      throw new EsiError(420, key, "ESI error limit reached; halting for 60s");
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      this.unavailableUntil = this.now() + OUTAGE_MS;
      throw new EsiUnavailableError(key, this.unavailableUntil);
    }
    return res;
  }

  private async waitForBudget(pathname: string, characterId: number): Promise<void> {
    for (const until of [this.haltUntil, this.errorLimitWaitUntil]) {
      const now = this.now();
      if (until > now) await this.sleep(until - now);
    }
    const group = this.pathGroup.get(routeTemplate(pathname));
    const until = group ? this.groupWait.get(`${group}:${characterId}`) ?? 0 : 0;
    if (until > this.now()) await this.sleep(until - this.now());
  }

  private noteLimits(pathname: string, characterId: number, res: Response): void {
    this.noteErrorLimit(res);
    const group = res.headers.get("X-Ratelimit-Group");
    const limit = parseLimit(res.headers.get("X-Ratelimit-Limit"));
    const remaining = Number(res.headers.get("X-Ratelimit-Remaining"));
    if (!group || !limit || Number.isNaN(remaining)) return;
    this.pathGroup.set(routeTemplate(pathname), group);
    const bucket = `${group}:${characterId}`;
    if (remaining < limit.tokens * THROTTLE_FRACTION) {
      // Wait long enough for roughly 10% of the window's tokens to come back, capped at 60s.
      this.groupWait.set(bucket, this.now() + Math.min(limit.windowMs * 0.1, 60_000));
    } else {
      this.groupWait.delete(bucket);
    }
  }

  /**
   * `X-ESI-Error-Limit-Remain` counts non-2xx/3xx responses left in a fixed 60 s window, starting
   * at 100; exhausting it means a 420 on every ESI route. Absent header → nothing to do; note that
   * `Number(null)` is 0, so the null check must come first.
   */
  private noteErrorLimit(res: Response): void {
    const raw = res.headers.get("X-ESI-Error-Limit-Remain");
    if (raw === null) return;
    const remain = Number(raw);
    if (Number.isNaN(remain) || remain >= ERROR_LIMIT_FLOOR) return;
    const reset = Number(res.headers.get("X-ESI-Error-Limit-Reset") ?? "60");
    const waitMs = (Number.isNaN(reset) ? 60 : Math.max(reset, 1)) * 1000;
    this.errorLimitWaitUntil = Math.max(this.errorLimitWaitUntil, this.now() + waitMs);
  }
}

function parseHttpDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
