import type { AppConfig } from "../config.js";
import type { getCharacter, setTokenStatus } from "../db/characters.js";
import { decryptSecret } from "../auth/crypto.js";
import { SsoError, type refreshAccessToken, type SsoMetadata } from "../auth/sso.js";

export class NeedsReauthError extends Error {
  constructor(public characterId: number) { super(`character ${characterId} needs re-authorisation`); this.name = "NeedsReauthError"; }
}
export interface TokenStoreDeps {
  config: AppConfig; getCharacter: typeof getCharacter; setTokenStatus: typeof setTokenStatus;
  refresh: typeof refreshAccessToken; metadata: () => Promise<SsoMetadata>; now?: () => number;
}
const EARLY_MS = 60_000;

export class TokenStore {
  private cache = new Map<number, { token: string; expiresAt: number }>();
  private inflight = new Map<number, Promise<string>>();
  constructor(private deps: TokenStoreDeps) {}

  getAccessToken(characterId: number): Promise<string> {
    const now = (this.deps.now ?? Date.now)();
    const hit = this.cache.get(characterId);
    if (hit && hit.expiresAt - EARLY_MS > now) return Promise.resolve(hit.token);
    let p = this.inflight.get(characterId);
    if (!p) {
      p = this.refresh(characterId).finally(() => this.inflight.delete(characterId));
      this.inflight.set(characterId, p);
    }
    return p;
  }

  private async refresh(characterId: number): Promise<string> {
    const c = await this.deps.getCharacter(characterId);
    if (!c) throw new Error(`unknown character ${characterId}`);
    if (c.tokenStatus !== "ok") throw new NeedsReauthError(characterId);
    const refreshToken = decryptSecret(c.refreshTokenEnc, this.deps.config.sessionSecret);
    try {
      const t = await this.deps.refresh({ metadata: await this.deps.metadata(), clientId: this.deps.config.eveClientId, clientSecret: this.deps.config.eveClientSecret, refreshToken });
      const now = (this.deps.now ?? Date.now)();
      this.cache.set(characterId, { token: t.access_token, expiresAt: now + t.expires_in * 1000 });
      return t.access_token;
    } catch (e) {
      if (e instanceof SsoError && e.code === "invalid_grant") {
        await this.deps.setTokenStatus(characterId, "needs_reauth");
        this.cache.delete(characterId);
        throw new NeedsReauthError(characterId);
      }
      throw e;
    }
  }
}
