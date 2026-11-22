import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";

// Confirmed against https://accounts.google.com/.well-known/openid-configuration (2026-11-22).
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
// Google's ID tokens carry either form of the issuer.
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export class GoogleError extends Error {
  constructor(public code: "token" | "jwt", message: string) { super(message); this.name = "GoogleError"; }
}

export interface GoogleIdentity { sub: string; email: string }

export function buildGoogleAuthorizeUrl(a: { clientId: string; callbackUrl: string; state: string; challenge: string; nonce: string }): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", a.clientId);
  url.searchParams.set("redirect_uri", a.callbackUrl);
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", a.state);
  url.searchParams.set("code_challenge", a.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("nonce", a.nonce);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

/** Trades an authorisation code for Google's ID token. Any failure (offline, non-200, no id_token) is a "token" error. */
export async function exchangeGoogleCode(a: { clientId: string; clientSecret: string; callbackUrl: string; code: string; verifier: string; fetchImpl?: typeof fetch }): Promise<{ idToken: string }> {
  const fetchImpl = a.fetchImpl ?? fetch;
  let r: Response;
  try {
    r = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code", code: a.code, code_verifier: a.verifier,
        client_id: a.clientId, client_secret: a.clientSecret, redirect_uri: a.callbackUrl,
      }).toString(),
    });
  } catch (e) { throw new GoogleError("token", `Google token request failed: ${(e as Error).message}`); }
  const json = (await r.json().catch(() => ({}))) as { id_token?: unknown; error?: string };
  if (!r.ok) throw new GoogleError("token", `Google token endpoint HTTP ${r.status}: ${json.error ?? ""}`);
  if (typeof json.id_token !== "string" || json.id_token === "") throw new GoogleError("token", "Google token response has no id_token");
  return { idToken: json.id_token };
}

/** Verifies a Google ID token's signature, issuer, audience, expiry, nonce and verified email. Any failure is a "jwt" error. */
export async function verifyGoogleIdToken(token: string, a: { jwks: JWTVerifyGetKey; clientId: string; nonce?: string }): Promise<GoogleIdentity> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, a.jwks, { issuer: GOOGLE_ISSUERS, audience: a.clientId }));
  } catch (e) { throw new GoogleError("jwt", `Google ID token verification failed: ${(e as Error).message}`); }
  if (a.nonce !== undefined && payload.nonce !== a.nonce) throw new GoogleError("jwt", "Google ID token nonce does not match");
  if (payload.email_verified !== true && payload.email_verified !== "true") throw new GoogleError("jwt", "Google account email is not verified");
  const { sub, email } = payload;
  if (typeof sub !== "string" || sub === "") throw new GoogleError("jwt", "Google ID token has no sub");
  if (typeof email !== "string" || email.trim() === "") throw new GoogleError("jwt", "Google ID token has no email");
  return { sub, email: email.trim().toLowerCase() };
}

let jwks: JWTVerifyGetKey | undefined;
export function googleJwks(): JWTVerifyGetKey {
  return (jwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)));
}
