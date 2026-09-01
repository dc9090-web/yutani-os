import type { AppConfig } from "../config.js";
import type { getCached, putCached } from "../db/esi-cache.js";

export interface EsiDeps {
  fetchImpl?: typeof fetch; getAccessToken: (characterId: number) => Promise<string>;
  cache: { get: typeof getCached; put: typeof putCached };
  config: Pick<AppConfig, "esiBaseUrl" | "esiCompatibilityDate" | "esiUserAgent">;
  now?: () => number; sleep?: (ms: number) => Promise<void>; timeoutMs?: number;
}
export interface EsiResult<T> { data: T; status: number; pages: number; fromCache: boolean }
export class EsiError extends Error {
  constructor(public status: number, public path: string, message: string) { super(message); this.name = "EsiError"; }
}
interface GetOpts { characterId?: number; query?: Record<string, string | number>; page?: number }
interface PostOpts { characterId?: number; query?: Record<string, string | number> }

const HALT_MS = 60_000;
const THROTTLE_FRACTION = 0.2;

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
    if (cached?.expiresAt && cached.expiresAt.getTime() > this.now()) {
      return { data: cached.body as T, status: 200, pages: cached.pages, fromCache: true };
    }

    const headers = await this.headers(opts.characterId);
    if (cached?.etag) headers["If-None-Match"] = cached.etag;
    const res = await this.request(url, key, cid, () => ({ headers, signal: AbortSignal.timeout(this.timeoutMs) }));

    const pages = Number(res.headers.get("X-Pages") ?? cached?.pages ?? 1) || 1;
    const expiresAt = parseHttpDate(res.headers.get("Expires"));

    if (res.status === 304 && cached) {
      await this.deps.cache.put(cid, key, { ...cached, expiresAt: expiresAt ?? cached.expiresAt, pages });
      return { data: cached.body as T, status: 304, pages, fromCache: true };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new EsiError(res.status, key, `ESI ${res.status} for ${key}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as T;
    await this.deps.cache.put(cid, key, { etag: res.headers.get("ETag"), expiresAt, pages, body: data });
    return { data, status: res.status, pages, fromCache: false };
  }

  async getAll<T>(path: string, opts: Omit<GetOpts, "page"> = {}): Promise<T[]> {
    const first = await this.get<T[]>(path, { ...opts, page: 1 });
    const out = [...first.data];
    for (let p = 2; p <= first.pages; p++) out.push(...(await this.get<T[]>(path, { ...opts, page: p })).data);
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

  /** Shared pre/post-flight for every HTTP call: budget waits, one 429 retry, the 420 halt. */
  private async request(url: URL, key: string, characterId: number, makeInit: () => RequestInit): Promise<Response> {
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
    return res;
  }

  private async waitForBudget(pathname: string, characterId: number): Promise<void> {
    const now = this.now();
    if (this.haltUntil > now) await this.sleep(this.haltUntil - now);
    const group = this.pathGroup.get(routeTemplate(pathname));
    const until = group ? this.groupWait.get(`${group}:${characterId}`) ?? 0 : 0;
    if (until > this.now()) await this.sleep(until - this.now());
  }

  private noteLimits(pathname: string, characterId: number, res: Response): void {
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
}

function parseHttpDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
