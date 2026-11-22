import { describe, it, expect, vi } from "vitest";
import { startGoogleLogin, completeGoogleLogin, type GoogleFlowDeps } from "../../src/lib/auth/google-flow.js";
import { GoogleError } from "../../src/lib/auth/google.js";
import { signPayload, verifyPayload, OAUTH_MAX_AGE, type OauthPayload } from "../../src/lib/auth/session.js";
import { loadConfig } from "../../src/lib/config.js";

const config = loadConfig({
  NODE_ENV: "test",
  EVE_CLIENT_ID: "cid", EVE_CLIENT_SECRET: "sec", EVE_CALLBACK_URL: "https://eve.example.com/auth/callback",
  ALLOWED_CHARACTER_IDS: "669539978", ESI_COMPATIBILITY_DATE: "2026-08-28", ESI_USER_AGENT: "ua",
  SESSION_SECRET: "s".repeat(32), DATABASE_URL: "postgres://x",
  GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsec", ALLOWED_GOOGLE_EMAILS: "owner@example.com",
});

function deps(over: Partial<GoogleFlowDeps> = {}): GoogleFlowDeps {
  return {
    exchange: vi.fn(async () => ({ idToken: "tok" })),
    verify: vi.fn(async () => ({ sub: "g-1", email: "owner@example.com" })),
    jwks: () => (async () => { throw new Error("unused"); }) as never,
    ...over,
  };
}

const now = Math.floor(Date.now() / 1000);
const cookie = signPayload({ state: "st", verifier: "ver", nonce: "n1", iat: now }, config.sessionSecret);

describe("startGoogleLogin", () => {
  it("start: the cookie holds the state, verifier and nonce that are in the URL", () => {
    const { url, oauthCookie } = startGoogleLogin(config);
    const p = verifyPayload<OauthPayload>(oauthCookie, config.sessionSecret, OAUTH_MAX_AGE)!;
    const q = new URL(url).searchParams;
    expect(q.get("state")).toBe(p.state);
    expect(q.get("nonce")).toBe(p.nonce);
    expect(p.verifier.length).toBeGreaterThan(40);
    expect(q.get("code_challenge")).toBeTruthy();
    expect(q.get("client_id")).toBe("gid");
    expect(q.get("redirect_uri")).toBe("https://eve.example.com/auth/google/callback");
  });
});

describe("completeGoogleLogin", () => {
  it("complete: returns the identity and passes the verifier and nonce on", async () => {
    const d = deps();
    expect(await completeGoogleLogin({ code: "c", state: "st", error: null, oauthCookie: cookie }, config, d)).toEqual({ sub: "g-1", email: "owner@example.com" });
    expect(d.exchange).toHaveBeenCalledWith(expect.objectContaining({ code: "c", verifier: "ver", clientId: "gid", clientSecret: "gsec", callbackUrl: "https://eve.example.com/auth/google/callback" }));
    expect(d.verify).toHaveBeenCalledWith("tok", expect.objectContaining({ clientId: "gid", nonce: "n1" }));
  });

  it("complete: an email written differently from the allow-list is still the owner", async () => {
    const d = deps({ verify: vi.fn(async () => ({ sub: "g-1", email: "Owner@Example.com " })) });
    await expect(completeGoogleLogin({ code: "c", state: "st", error: null, oauthCookie: cookie }, config, d)).resolves.toEqual({ sub: "g-1", email: "owner@example.com" });
  });

  it("complete: refuses an account that is not on the list", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ verify: vi.fn(async () => ({ sub: "g-2", email: "stranger@example.com" })) });
    await expect(completeGoogleLogin({ code: "c", state: "st", error: null, oauthCookie: cookie }, config, d)).rejects.toMatchObject({ code: "not-allowed" });
    expect(err).toHaveBeenCalledWith("[auth] google account not allowed:", "stranger@example.com");
    err.mockRestore();
  });

  it("complete: a cancelled sign-in never reaches Google", async () => {
    const d = deps();
    await expect(completeGoogleLogin({ code: null, state: "st", error: "access_denied", oauthCookie: cookie }, config, d)).rejects.toMatchObject({ code: "cancelled" });
    expect(d.exchange).not.toHaveBeenCalled();
  });

  it("complete: state mismatch, missing cookie and missing code are state errors", async () => {
    const expired = signPayload({ state: "st", verifier: "ver", nonce: "n1", iat: now - OAUTH_MAX_AGE - 60 }, config.sessionSecret);
    await expect(completeGoogleLogin({ code: "c", state: "other", error: null, oauthCookie: cookie }, config, deps())).rejects.toMatchObject({ code: "state" });
    await expect(completeGoogleLogin({ code: "c", state: "st", error: null, oauthCookie: undefined }, config, deps())).rejects.toMatchObject({ code: "state" });
    await expect(completeGoogleLogin({ code: null, state: "st", error: null, oauthCookie: cookie }, config, deps())).rejects.toMatchObject({ code: "state" });
    await expect(completeGoogleLogin({ code: "c", state: "st", error: null, oauthCookie: expired }, config, deps())).rejects.toMatchObject({ code: "state" });
  });

  it("complete: maps Google's token and jwt failures", async () => {
    const d1 = deps({ exchange: vi.fn(async () => { throw new GoogleError("token", "offline"); }) });
    await expect(completeGoogleLogin({ code: "c", state: "st", error: null, oauthCookie: cookie }, config, d1)).rejects.toMatchObject({ code: "token" });
    const d2 = deps({ verify: vi.fn(async () => { throw new GoogleError("jwt", "bad sig"); }) });
    await expect(completeGoogleLogin({ code: "c", state: "st", error: null, oauthCookie: cookie }, config, d2)).rejects.toMatchObject({ code: "jwt" });
  });
});
