import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";

export const SCOPES = [
  "esi-skills.read_skills.v1", "esi-skills.read_skillqueue.v1", "esi-assets.read_assets.v1",
  "esi-fittings.read_fittings.v1", "esi-clones.read_clones.v1", "esi-clones.read_implants.v1",
  "esi-wallet.read_character_wallet.v1", "esi-killmails.read_killmails.v1",
  "esi-location.read_location.v1", "esi-location.read_ship_type.v1",
];
export const SSO_METADATA_URL = "https://login.eveonline.com/.well-known/oauth-authorization-server";

export interface SsoMetadata { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string }
export interface TokenResponse { access_token: string; refresh_token: string; expires_in: number }
export interface VerifiedToken { characterId: number; name: string; scopes: string[]; owner: string }

export class SsoError extends Error {
  constructor(public code: "invalid_grant" | "token_http" | "jwt", message: string) { super(message); this.name = "SsoError"; }
}

let metadataPromise: Promise<SsoMetadata> | undefined;
export function getSsoMetadata(fetchImpl: typeof fetch = fetch): Promise<SsoMetadata> {
  metadataPromise ??= fetchImpl(SSO_METADATA_URL).then(async (r) => {
    if (!r.ok) { metadataPromise = undefined; throw new SsoError("token_http", `SSO metadata HTTP ${r.status}`); }
    return (await r.json()) as SsoMetadata;
  });
  return metadataPromise;
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function buildAuthorizeUrl(a: { metadata: SsoMetadata; clientId: string; callbackUrl: string; state: string; challenge: string; scopes?: string[] }): string {
  const url = new URL(a.metadata.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", a.callbackUrl);
  url.searchParams.set("client_id", a.clientId);
  url.searchParams.set("scope", (a.scopes ?? SCOPES).join(" "));
  url.searchParams.set("code_challenge", a.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", a.state);
  return url.toString();
}

async function tokenRequest(metadata: SsoMetadata, clientId: string, clientSecret: string, form: Record<string, string>, fetchImpl: typeof fetch): Promise<TokenResponse> {
  const r = await fetchImpl(metadata.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      Host: "login.eveonline.com",
    },
    body: new URLSearchParams(form).toString(),
  });
  const json = (await r.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
  if (r.status === 400 && json.error === "invalid_grant") throw new SsoError("invalid_grant", "refresh token revoked or invalid");
  if (!r.ok) throw new SsoError("token_http", `SSO token endpoint HTTP ${r.status}: ${json.error ?? ""}`);
  return { access_token: json.access_token!, refresh_token: json.refresh_token!, expires_in: json.expires_in! };
}

export function exchangeCode(a: { metadata: SsoMetadata; clientId: string; clientSecret: string; code: string; verifier: string; fetchImpl?: typeof fetch }) {
  return tokenRequest(a.metadata, a.clientId, a.clientSecret, { grant_type: "authorization_code", code: a.code, code_verifier: a.verifier }, a.fetchImpl ?? fetch);
}

export function refreshAccessToken(a: { metadata: SsoMetadata; clientId: string; clientSecret: string; refreshToken: string; fetchImpl?: typeof fetch }) {
  return tokenRequest(a.metadata, a.clientId, a.clientSecret, { grant_type: "refresh_token", refresh_token: a.refreshToken }, a.fetchImpl ?? fetch);
}

export async function verifyEveJwt(token: string, a: { jwks: JWTVerifyGetKey; clientId: string }): Promise<VerifiedToken> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, a.jwks, { issuer: ["https://login.eveonline.com/", "login.eveonline.com"], audience: "EVE Online" }));
  } catch (e) { throw new SsoError("jwt", `JWT verification failed: ${(e as Error).message}`); }
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(a.clientId)) throw new SsoError("jwt", "JWT audience does not include our client id");
  const m = /^CHARACTER:EVE:(\d+)$/.exec(payload.sub ?? "");
  if (!m) throw new SsoError("jwt", `unexpected sub ${payload.sub}`);
  const scp = payload.scp as string | string[] | undefined;
  return { characterId: Number(m[1]), name: String(payload.name ?? ""), scopes: Array.isArray(scp) ? scp : scp ? [scp] : [], owner: String(payload.owner ?? "") };
}

let jwks: JWTVerifyGetKey | undefined;
export function remoteJwks(metadata: SsoMetadata): JWTVerifyGetKey {
  return (jwks ??= createRemoteJWKSet(new URL(metadata.jwks_uri)));
}
