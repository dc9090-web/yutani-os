import type { AppConfig } from "../config.js";
import type { getCached, putCached } from "../db/esi-cache.js";

export interface EsiDeps {
  fetchImpl?: typeof fetch; getAccessToken: (characterId: number) => Promise<string>;
  cache: { get: typeof getCached; put: typeof putCached };
  config: Pick<AppConfig, "esiBaseUrl" | "esiCompatibilityDate" | "esiUserAgent">;
  now?: () => number; sleep?: (ms: number) => Promise<void>;
}
export interface EsiResult<T> { data: T; status: number; pages: number; fromCache: boolean }
export class EsiError extends Error {
  constructor(public status: number, public path: string, message: string) { super(message); this.name = "EsiError"; }
}
interface GetOpts { characterId?: number; query?: Record<string, string | number>; page?: number }

const HALT_MS = 60_000;
const THROTTLE_FRACTION = 0.2;

/** "150/15m" → { tokens: 150, windowMs: 900000 } */
export function parseLimit(v: string | null): { tokens: number; windowMs: number } | null {
  const m = /^(\d+)\/(\d+)([smh])$/.exec(v ?? "");
  if (!m) return null;
  const unit = { s: 1000, m: 60_000, h: 3_600_000 }[m[3] as "s" | "m" | "h"];
  return { tokens: Number(m[1]), windowMs: Number(m[2]) * unit };
}

export class EsiClient {
  private fetchImpl: typeof fetch; private now: () => number; private sleep: (ms: number) => Promise<void>;
  private haltUntil = 0;
  private groupWait = new Map<string, number>();   // group → time when it is OK to call again
  private pathGroup = new Map<string, string>();   // path (no query) → rate-limit group

  constructor(private deps: EsiDeps) {
    this.fetchImpl = deps.fetchImpl ?? fetch; this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async get<T>(path: string, opts: GetOpts = {}): Promise<EsiResult<T>> {
    const cid = opts.characterId ?? 0;
    const url = new URL(path, this.deps.config.esiBaseUrl);
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));
    if (opts.page) url.searchParams.set("page", String(opts.page));
    const key = url.pathname + url.search;

    const cached = await this.deps.cache.get(cid, key);
    if (cached?.expiresAt && cached.expiresAt.getTime() > this.now()) {
      return { data: cached.body as T, status: 200, pages: cached.pages, fromCache: true };
    }
    await this.waitForBudget(url.pathname);

    const headers: Record<string, string> = {
      Accept: "application/json", "User-Agent": this.deps.config.esiUserAgent, "X-Compatibility-Date": this.deps.config.esiCompatibilityDate,
    };
    if (opts.characterId) headers.Authorization = `Bearer ${await this.deps.getAccessToken(opts.characterId)}`;
    if (cached?.etag) headers["If-None-Match"] = cached.etag;

    let res = await this.fetchImpl(url, { headers });
    this.noteRateLimit(url.pathname, res);
    if (res.status === 429) {
      const retry = Number(res.headers.get("Retry-After") ?? "5");
      await this.sleep(retry * 1000);
      res = await this.fetchImpl(url, { headers });
      this.noteRateLimit(url.pathname, res);
    }
    if (res.status === 420) { this.haltUntil = this.now() + HALT_MS; throw new EsiError(420, key, "ESI error limit reached; halting for 60s"); }

    const pages = Number(res.headers.get("X-Pages") ?? cached?.pages ?? 1) || 1;
    const expiresHeader = res.headers.get("Expires");
    const expiresAt = expiresHeader ? new Date(expiresHeader) : null;

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

  private async waitForBudget(pathname: string): Promise<void> {
    const now = this.now();
    if (this.haltUntil > now) await this.sleep(this.haltUntil - now);
    const group = this.pathGroup.get(pathname);
    const until = group ? this.groupWait.get(group) ?? 0 : 0;
    if (until > this.now()) await this.sleep(until - this.now());
  }

  private noteRateLimit(pathname: string, res: Response): void {
    const group = res.headers.get("X-Ratelimit-Group");
    const limit = parseLimit(res.headers.get("X-Ratelimit-Limit"));
    const remaining = Number(res.headers.get("X-Ratelimit-Remaining"));
    if (!group || !limit || Number.isNaN(remaining)) return;
    this.pathGroup.set(pathname, group);
    if (remaining < limit.tokens * THROTTLE_FRACTION) {
      // Wait long enough for roughly 10% of the window's tokens to come back, capped at 60s.
      const wait = Math.min(limit.windowMs * 0.1, 60_000);
      this.groupWait.set(group, this.now() + wait);
    } else {
      this.groupWait.delete(group);
    }
  }
}
