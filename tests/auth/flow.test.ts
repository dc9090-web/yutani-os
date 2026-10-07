import { describe, it, expect, vi } from "vitest";
import { startLogin, completeLogin, AuthError, safeNextPath, type FlowDeps } from "../../src/lib/auth/flow.js";
import { decryptSecret } from "../../src/lib/auth/crypto.js";
import { signPayload, verifyPayload, OAUTH_MAX_AGE, type OauthPayload } from "../../src/lib/auth/session.js";
import { loadConfig } from "../../src/lib/config.js";
import type { SsoMetadata } from "../../src/lib/auth/sso.js";

const config = loadConfig({
  NODE_ENV: "test",
  EVE_CLIENT_ID: "cid", EVE_CLIENT_SECRET: "sec", EVE_CALLBACK_URL: "https://eve.example.com/auth/callback",
  ALLOWED_CHARACTER_IDS: "669539978", ESI_COMPATIBILITY_DATE: "2026-08-28", ESI_USER_AGENT: "ua",
  SESSION_SECRET: "s".repeat(32), DATABASE_URL: "postgres://x",
});
const metadata: SsoMetadata = { issuer: "https://login.eveonline.com/", authorization_endpoint: "https://login.eveonline.com/v2/oauth/authorize", token_endpoint: "https://login.eveonline.com/v2/oauth/token", jwks_uri: "https://login.eveonline.com/oauth/jwks" };

function deps(over: Partial<FlowDeps> = {}): FlowDeps {
  return {
    metadata: async () => metadata,
    jwks: () => (async () => { throw new Error("unused"); }) as never,
    exchange: vi.fn(async () => ({ access_token: "at", refresh_token: "rt", expires_in: 1199 })),
    verify: vi.fn(async () => ({ characterId: 669539978, name: "TrilliumONE", scopes: ["a"], owner: "o" })),
    upsert: vi.fn(async (input: { id: number; name: string; refreshTokenEnc: string; scopes: string[] }) => ({ ...input, accountId: null, corporationId: null, corporationName: null, allianceId: null, allianceName: null, tokenStatus: "ok" as const, lastLoginAt: null })),
    ...over,
  } as FlowDeps;
}

describe("startLogin", () => {
  it("returns an authorize URL and a signed oauth cookie holding state+verifier", async () => {
    const { url, oauthCookie } = await startLogin(config, { metadata: async () => metadata });
    const p = verifyPayload<OauthPayload>(oauthCookie, config.sessionSecret, OAUTH_MAX_AGE)!;
    expect(new URL(url).searchParams.get("state")).toBe(p.state);
    expect(p.verifier.length).toBeGreaterThan(40);
  });
});

describe("completeLogin", () => {
  const cookie = signPayload({ state: "st", verifier: "ver", iat: Math.floor(Date.now() / 1000) }, config.sessionSecret);

  it("stores the encrypted refresh token and returns the character", async () => {
    const d = deps();
    const out = await completeLogin({ code: "c", state: "st", oauthCookie: cookie }, config, d);
    expect(out).toEqual({ characterId: 669539978, name: "TrilliumONE" });
    const arg = (d.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.refreshTokenEnc).toMatch(/^v1\./);
    expect(arg.refreshTokenEnc).not.toBe("rt");
    expect(decryptSecret(arg.refreshTokenEnc, config.sessionSecret)).toBe("rt");
    expect(arg.scopes).toEqual(["a"]);
  });
  it("rejects state mismatch / missing cookie", async () => {
    await expect(completeLogin({ code: "c", state: "other", oauthCookie: cookie }, config, deps())).rejects.toMatchObject({ code: "state" });
    await expect(completeLogin({ code: "c", state: "st", oauthCookie: undefined }, config, deps())).rejects.toMatchObject({ code: "state" });
  });
  it("rejects a character that is not allow-listed and does not persist it", async () => {
    const d = deps({ verify: vi.fn(async () => ({ characterId: 42, name: "Stranger", scopes: [], owner: "o" })) });
    await expect(completeLogin({ code: "c", state: "st", oauthCookie: cookie }, config, d)).rejects.toMatchObject({ code: "not-allowed" });
    expect(d.upsert).not.toHaveBeenCalled();
  });
  it("maps token and jwt failures", async () => {
    const d1 = deps({ exchange: vi.fn(async () => { throw new Error("http 500"); }) });
    await expect(completeLogin({ code: "c", state: "st", oauthCookie: cookie }, config, d1)).rejects.toBeInstanceOf(AuthError);
    const d2 = deps({ verify: vi.fn(async () => { throw new Error("bad sig"); }) });
    await expect(completeLogin({ code: "c", state: "st", oauthCookie: cookie }, config, d2)).rejects.toMatchObject({ code: "jwt" });
  });
});

describe("safeNextPath", () => {
  const origin = "https://eve.example.com";
  it.each([
    ["/ships", "/ships"],
    ["//evil.com/x", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    [undefined, "/"],
    ["/a?b=1", "/a?b=1"],
  ])("safeNextPath(%j) -> %j", (input, expected) => {
    expect(safeNextPath(input, origin)).toBe(expected);
  });
});
