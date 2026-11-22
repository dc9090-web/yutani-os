import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from "jose";

const { createAppSession, findAppSession, touchAppSession } = vi.hoisted(() => ({
  createAppSession: vi.fn(), findAppSession: vi.fn(), touchAppSession: vi.fn(),
}));
vi.mock("../../src/lib/db/app-sessions.js", () => ({ createAppSession, findAppSession, touchAppSession }));

const { appGoogleLogin, authenticateApi, bearerToken, parseDeviceName } = await import("../../src/lib/auth/app-session.js");
const { verifyGoogleIdToken } = await import("../../src/lib/auth/google.js");
const { SESSION_COOKIE, signPayload } = await import("../../src/lib/auth/session.js");
import type { AppConfig } from "../../src/lib/config.js";

const config = { googleClientId: "gid", sessionSecret: "s".repeat(32), allowedGoogleEmails: new Set(["owner@example.com"]) } as AppConfig;
const request = (headers: Record<string, string> = {}) => new NextRequest("https://eve.example.com/api/v1/me", { headers });

beforeEach(() => {
  vi.resetAllMocks();
  createAppSession.mockResolvedValue({ id: 5, token: "fresh-token" });
});

describe("bearerToken", () => {
  it("reads the token of a Bearer header, whatever the case of the scheme", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("bearer abc")).toBe("abc");
  });
  it("is null for no header, another scheme or an empty token", () => {
    for (const header of [null, undefined, "", "Basic abc", "Bearer", "Bearer ", "Bearer a b"]) expect(bearerToken(header)).toBeNull();
  });
});

describe("parseDeviceName", () => {
  it("trims, and refuses empty, long or non-string names", () => {
    expect(parseDeviceName("  Pixel 9 ")).toBe("Pixel 9");
    for (const raw of ["", "   ", "x".repeat(81), 7, null, undefined]) expect(parseDeviceName(raw)).toBeNull();
  });
});

describe("authenticateApi", () => {
  const session = { id: 3, sub: "g-1", email: "owner@example.com", deviceName: "Pixel 9", createdAt: new Date(), lastUsedAt: null };
  const cookie = () => signPayload({ sub: "g-9", email: "owner@example.com", activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) }, config.sessionSecret);

  it("accepts a live bearer session and records its use", async () => {
    findAppSession.mockResolvedValue(session);
    expect(await authenticateApi(request({ authorization: "Bearer tok" }), config)).toEqual({ sub: "g-1", email: "owner@example.com", appSessionId: 3 });
    expect(findAppSession).toHaveBeenCalledWith("tok");
    expect(touchAppSession).toHaveBeenCalledWith(3);
  });

  it("refuses an unknown or revoked token", async () => {
    findAppSession.mockResolvedValue(null);
    expect(await authenticateApi(request({ authorization: "Bearer tok" }), config)).toBeNull();
  });

  it("refuses a bearer session whose account is no longer on the allow-list", async () => {
    findAppSession.mockResolvedValue({ ...session, email: "removed@example.com" });
    expect(await authenticateApi(request({ authorization: "Bearer tok" }), config)).toBeNull();
    expect(touchAppSession).not.toHaveBeenCalled();
  });

  it("accepts the site's cookie when there is no Authorization header", async () => {
    const req = request();
    req.cookies.set(SESSION_COOKIE, cookie());
    expect(await authenticateApi(req, config)).toEqual({ sub: "g-9", email: "owner@example.com", appSessionId: null });
    expect(findAppSession).not.toHaveBeenCalled();
  });

  it("does not let a cookie rescue a bad bearer token", async () => {
    findAppSession.mockResolvedValue(null);
    for (const authorization of ["Bearer wrong", "Basic abc", "Bearer"]) {
      const req = request({ authorization });
      req.cookies.set(SESSION_COOKIE, cookie());
      expect(await authenticateApi(req, config)).toBeNull();
    }
  });

  it("refuses a request with neither", async () => {
    expect(await authenticateApi(request(), config)).toBeNull();
  });
});

describe("appGoogleLogin", () => {
  const jwks = (() => ({})) as never;
  const deps = (verify: ReturnType<typeof vi.fn>) => ({ verify: verify as never, jwks: () => jwks });

  it("creates an app session for an allowed account and returns its token", async () => {
    const verify = vi.fn().mockResolvedValue({ sub: "g-1", email: "Owner@Example.com" });
    expect(await appGoogleLogin({ idToken: "id.tok", deviceName: "Pixel 9" }, config, deps(verify))).toEqual({ token: "fresh-token", email: "owner@example.com" });
    expect(createAppSession).toHaveBeenCalledWith({ sub: "g-1", email: "owner@example.com", deviceName: "Pixel 9" });
    // The web client ID is the audience, and no nonce is asked for: this flow has no redirect to bind one to.
    expect(verify).toHaveBeenCalledWith("id.tok", { jwks, clientId: "gid" });
  });

  it("refuses an account off the allow-list, and logs the address so it can be added", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const verify = vi.fn().mockResolvedValue({ sub: "g-2", email: "stranger@example.com" });
    await expect(appGoogleLogin({ idToken: "id.tok", deviceName: "Pixel 9" }, config, deps(verify))).rejects.toMatchObject({ code: "not-allowed" });
    expect(error).toHaveBeenCalledWith("[auth] google account not allowed:", "stranger@example.com");
    expect(createAppSession).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("turns any verification failure into a jwt error", async () => {
    const verify = vi.fn().mockRejectedValue(new Error("signature verification failed"));
    await expect(appGoogleLogin({ idToken: "bad", deviceName: "Pixel 9" }, config, deps(verify))).rejects.toMatchObject({ code: "jwt" });
    expect(createAppSession).not.toHaveBeenCalled();
  });

  it("with the real verifier: a token without a nonce passes here, a wrong audience or unverified email does not", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const localJwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" }] });
    const token = (claims: Record<string, unknown>, audience = "gid") =>
      new SignJWT({ email: "owner@example.com", email_verified: true, ...claims })
        .setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer("https://accounts.google.com").setAudience(audience)
        .setSubject("g-1").setIssuedAt().setExpirationTime("5m").sign(privateKey);
    const real = { verify: verifyGoogleIdToken, jwks: () => localJwks };

    expect(await appGoogleLogin({ idToken: await token({}), deviceName: "Pixel 9" }, config, real)).toEqual({ token: "fresh-token", email: "owner@example.com" });
    await expect(appGoogleLogin({ idToken: await token({}, "another-client"), deviceName: "Pixel 9" }, config, real)).rejects.toMatchObject({ code: "jwt" });
    await expect(appGoogleLogin({ idToken: await token({ email_verified: false }), deviceName: "Pixel 9" }, config, real)).rejects.toMatchObject({ code: "jwt" });
    // The web flow still insists: the same nonce-less token fails when a nonce is expected.
    await expect(verifyGoogleIdToken(await token({}), { jwks: localJwks, clientId: "gid", nonce: "n1" })).rejects.toMatchObject({ code: "jwt" });
  });
});
