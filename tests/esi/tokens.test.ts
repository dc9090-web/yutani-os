import { describe, it, expect, vi } from "vitest";
import { TokenStore, NeedsReauthError } from "../../src/lib/esi/tokens.js";
import { encryptSecret, decryptSecret } from "../../src/lib/auth/crypto.js";
import { SsoError, type refreshAccessToken } from "../../src/lib/auth/sso.js";
import { loadConfig } from "../../src/lib/config.js";
import type { updateRefreshToken as updateRefreshTokenFn } from "../../src/lib/db/characters.js";

const config = loadConfig({ NODE_ENV: "test", EVE_CLIENT_ID: "cid", EVE_CLIENT_SECRET: "sec", EVE_CALLBACK_URL: "https://x/cb", ALLOWED_CHARACTER_IDS: "1", ESI_COMPATIBILITY_DATE: "2026-08-28", ESI_USER_AGENT: "ua", SESSION_SECRET: "s".repeat(32), DATABASE_URL: "postgres://x" });
const metadata = { issuer: "i", authorization_endpoint: "a", token_endpoint: "t", jwks_uri: "j" };
const character = { id: 1, name: "n", accountId: null, corporationId: null, corporationName: null, allianceId: null, allianceName: null, raceId: null, refreshTokenEnc: encryptSecret("rt-plain", config.sessionSecret), scopes: [], tokenStatus: "ok" as const, lastLoginAt: null };

function make(refresh = vi.fn<typeof refreshAccessToken>(async () => ({ access_token: "at1", refresh_token: "rt-plain", expires_in: 1199 }))) {
  let t = 1_000_000;
  const updateRefreshToken = vi.fn<typeof updateRefreshTokenFn>(async () => {});
  const store = new TokenStore({
    config, getCharacter: vi.fn(async () => character), setTokenStatus: vi.fn(async () => {}), updateRefreshToken,
    encrypt: (p) => encryptSecret(p, config.sessionSecret), refresh, metadata: async () => metadata, now: () => t,
  });
  return { store, refresh, updateRefreshToken, advance: (ms: number) => { t += ms; } };
}

describe("TokenStore", () => {
  it("decrypts the stored refresh token, refreshes once, then caches until 60s before expiry", async () => {
    const { store, refresh, advance } = make();
    expect(await store.getAccessToken(1)).toBe("at1");
    expect(refresh.mock.calls[0][0].refreshToken).toBe("rt-plain");
    advance(1000 * 1000);
    expect(await store.getAccessToken(1)).toBe("at1");
    expect(refresh).toHaveBeenCalledTimes(1);
    advance(1000 * 140);  // now within 60s of the 1199s expiry
    await store.getAccessToken(1);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("marks needs_reauth on invalid_grant", async () => {
    const refresh = vi.fn(async () => { throw new SsoError("invalid_grant", "revoked"); });
    const setTokenStatus = vi.fn(async () => {});
    const store = new TokenStore({
      config, getCharacter: vi.fn(async () => character), setTokenStatus, updateRefreshToken: vi.fn(async () => {}),
      encrypt: (p) => encryptSecret(p, config.sessionSecret), refresh, metadata: async () => metadata,
    });
    await expect(store.getAccessToken(1)).rejects.toBeInstanceOf(NeedsReauthError);
    expect(setTokenStatus).toHaveBeenCalledWith(1, "needs_reauth");
  });
  it("refuses characters already flagged needs_reauth without calling SSO", async () => {
    const refresh = vi.fn();
    const store = new TokenStore({
      config, getCharacter: vi.fn(async () => ({ ...character, tokenStatus: "needs_reauth" as const })), setTokenStatus: vi.fn(async () => {}),
      updateRefreshToken: vi.fn(async () => {}), encrypt: (p) => encryptSecret(p, config.sessionSecret), refresh, metadata: async () => metadata,
    });
    await expect(store.getAccessToken(1)).rejects.toBeInstanceOf(NeedsReauthError);
    expect(refresh).not.toHaveBeenCalled();
  });
  it("persists a rotated refresh token, encrypted", async () => {
    const { store, updateRefreshToken } = make(vi.fn(async () => ({ access_token: "at1", refresh_token: "rt-rotated", expires_in: 1199 })));
    await store.getAccessToken(1);
    expect(updateRefreshToken).toHaveBeenCalledTimes(1);
    const [id, enc] = updateRefreshToken.mock.calls[0];
    expect(id).toBe(1);
    expect(decryptSecret(enc, config.sessionSecret)).toBe("rt-rotated");
  });
  it("does not persist when the refresh token is unchanged", async () => {
    const { store, updateRefreshToken } = make();
    await store.getAccessToken(1);
    expect(updateRefreshToken).not.toHaveBeenCalled();
  });
});
