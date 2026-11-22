import { describe, it, expect, vi, beforeAll } from "vitest";
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet, type JWTVerifyGetKey, type CryptoKey } from "jose";
import { GOOGLE_AUTH_URL, buildGoogleAuthorizeUrl, exchangeGoogleCode, verifyGoogleIdToken } from "../../src/lib/auth/google.js";

let privateKey: CryptoKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] });
});

/** A Google-shaped ID token; `claims` override the defaults, and a claim set to undefined is left out. */
async function token(claims: Record<string, unknown>, o: { key?: CryptoKey; issuer?: string; audience?: string; expiresIn?: number } = {}) {
  const merged: Record<string, unknown> = { sub: "g-1", email: "Owner@Example.com", email_verified: true, nonce: "n1", ...claims };
  for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(merged).setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(o.issuer ?? "https://accounts.google.com").setAudience(o.audience ?? "gid")
    .setIssuedAt(now - 120).setExpirationTime(now + (o.expiresIn ?? 3600)).sign(o.key ?? privateKey);
}

const args = { clientId: "gid", clientSecret: "gsec", callbackUrl: "https://eve.example.com/auth/google/callback", code: "c1", verifier: "ver" };

describe("google", () => {
  it("accepts a good token and lower-cases the email", async () => {
    expect(await verifyGoogleIdToken(await token({}), { jwks, clientId: "gid", nonce: "n1" })).toEqual({ sub: "g-1", email: "owner@example.com" });
  });
  it("accepts email_verified sent as the string \"true\" and the bare-host issuer", async () => {
    await expect(verifyGoogleIdToken(await token({ email_verified: "true" }, { issuer: "accounts.google.com" }), { jwks, clientId: "gid" })).resolves.toMatchObject({ sub: "g-1" });
  });
  it.each([
    ["another app's audience", () => token({}, { audience: "someone-else" })],
    ["a wrong issuer", () => token({}, { issuer: "https://evil.example.com" })],
    ["an expired token", () => token({}, { expiresIn: -60 })],
    ["a token signed with another key", async () => token({}, { key: (await generateKeyPair("RS256")).privateKey })],
    ["an unverified email", () => token({ email_verified: false })],
    ["no email_verified claim", () => token({ email_verified: undefined })],
    ["a wrong nonce", () => token({ nonce: "other" })],
    ["no email", () => token({ email: undefined })],
  ])("refuses %s", async (_name, make) => {
    await expect(verifyGoogleIdToken(await make(), { jwks, clientId: "gid", nonce: "n1" })).rejects.toMatchObject({ code: "jwt" });
  });
  it("builds the authorise URL", () => {
    const u = new URL(buildGoogleAuthorizeUrl({ clientId: "gid", callbackUrl: "https://eve.example.com/auth/google/callback", state: "st", challenge: "ch", nonce: "n1" }));
    expect(u.origin + u.pathname).toBe(GOOGLE_AUTH_URL);
    expect(Object.fromEntries(u.searchParams)).toEqual({ response_type: "code", client_id: "gid", redirect_uri: "https://eve.example.com/auth/google/callback", scope: "openid email", state: "st", code_challenge: "ch", code_challenge_method: "S256", nonce: "n1", prompt: "select_account" });
  });
  it("exchanges a code and maps every failure to a token error", async () => {
    const ok = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ id_token: "tok" }), { status: 200 }));
    expect(await exchangeGoogleCode({ ...args, fetchImpl: ok as never })).toEqual({ idToken: "tok" });
    expect(String(ok.mock.calls[0][1]!.body)).toContain("code_verifier=ver");
    for (const bad of [async () => new Response("{}", { status: 400 }), async () => new Response("{}", { status: 200 }), async () => { throw new Error("offline"); }])
      await expect(exchangeGoogleCode({ ...args, fetchImpl: bad as never })).rejects.toMatchObject({ code: "token" });
  });
});
