import { describe, it, expect, vi } from "vitest";
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from "jose";
import { SCOPES, generatePkce, buildAuthorizeUrl, exchangeCode, refreshAccessToken, verifyEveJwt, getSsoMetadata, resetSsoMetadataCache, SsoError, type SsoMetadata } from "../../src/lib/auth/sso.js";
import { createHash } from "node:crypto";

const metadata: SsoMetadata = {
  issuer: "https://login.eveonline.com/",
  authorization_endpoint: "https://login.eveonline.com/v2/oauth/authorize",
  token_endpoint: "https://login.eveonline.com/v2/oauth/token",
  jwks_uri: "https://login.eveonline.com/oauth/jwks",
};

async function signedJwt(claims: Record<string, unknown>, opts: { aud?: string[]; iss?: string; sub?: string } = {}) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? "https://login.eveonline.com/").setAudience(opts.aud ?? ["cid", "EVE Online"])
    .setSubject(opts.sub ?? "CHARACTER:EVE:669539978").setIssuedAt().setExpirationTime("20m").sign(privateKey);
  return { token, jwks };
}

describe("sso", () => {
  it("exports the ten scopes", () => { expect(SCOPES.length).toBe(10); expect(SCOPES).toContain("esi-fittings.read_fittings.v1"); });

  it("does not memoise a rejected metadata fetch forever", async () => {
    resetSsoMetadataCache();
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      if (calls === 1) throw new Error("network down");
      return new Response(JSON.stringify(metadata), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(getSsoMetadata(fetchImpl)).rejects.toThrow("network down");
    await expect(getSsoMetadata(fetchImpl)).resolves.toEqual(metadata);
    expect(calls).toBe(2);
  });

  it("PKCE challenge is S256 of the verifier", () => {
    const { verifier, challenge } = generatePkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("builds the authorize URL", () => {
    const url = new URL(buildAuthorizeUrl({ metadata, clientId: "cid", callbackUrl: "https://eve.plasma66.com/auth/callback", state: "st", challenge: "ch" }));
    expect(url.origin + url.pathname).toBe(metadata.authorization_endpoint);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("https://eve.plasma66.com/auth/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("scope")).toBe(SCOPES.join(" "));
  });

  it("exchanges a code with basic auth + verifier", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code")).toBe("c0de");
      expect(body.get("code_verifier")).toBe("ver");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Basic " + Buffer.from("cid:sec").toString("base64"));
      return new Response(JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 1199, token_type: "Bearer" }), { status: 200 });
    }) as unknown as typeof fetch;
    const t = await exchangeCode({ metadata, clientId: "cid", clientSecret: "sec", code: "c0de", verifier: "ver", fetchImpl });
    expect(t).toMatchObject({ access_token: "at", refresh_token: "rt", expires_in: 1199 });
  });

  it("maps invalid_grant on refresh to SsoError('invalid_grant')", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })) as unknown as typeof fetch;
    await expect(refreshAccessToken({ metadata, clientId: "cid", clientSecret: "sec", refreshToken: "rt", fetchImpl }))
      .rejects.toMatchObject({ code: "invalid_grant" });
  });

  it("verifies a good JWT", async () => {
    const { token, jwks } = await signedJwt({ name: "TrilliumONE", scp: ["esi-skills.read_skills.v1", "esi-assets.read_assets.v1"], owner: "own" });
    const v = await verifyEveJwt(token, { jwks, clientId: "cid" });
    expect(v).toEqual({ characterId: 669539978, name: "TrilliumONE", scopes: ["esi-skills.read_skills.v1", "esi-assets.read_assets.v1"], owner: "own" });
  });

  it("accepts a single-string scp and rejects wrong aud/iss", async () => {
    const one = await signedJwt({ name: "n", scp: "esi-skills.read_skills.v1", owner: "o" });
    expect((await verifyEveJwt(one.token, { jwks: one.jwks, clientId: "cid" })).scopes).toEqual(["esi-skills.read_skills.v1"]);
    const badAud = await signedJwt({ name: "n", scp: [], owner: "o" }, { aud: ["other", "EVE Online"] });
    await expect(verifyEveJwt(badAud.token, { jwks: badAud.jwks, clientId: "cid" })).rejects.toBeInstanceOf(SsoError);
    const badIss = await signedJwt({ name: "n", scp: [], owner: "o" }, { iss: "https://evil.example/" });
    await expect(verifyEveJwt(badIss.token, { jwks: badIss.jwks, clientId: "cid" })).rejects.toBeInstanceOf(SsoError);
  });
});
