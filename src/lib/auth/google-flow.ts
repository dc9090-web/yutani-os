import { randomBytes } from "node:crypto";
import type { JWTVerifyGetKey } from "jose";
import type { AppConfig } from "../config.js";
import { AuthError } from "./flow.js";
import { buildGoogleAuthorizeUrl, exchangeGoogleCode, GoogleError, googleJwks, verifyGoogleIdToken, type GoogleIdentity } from "./google.js";
import { OAUTH_MAX_AGE, signPayload, verifyPayload, type OauthPayload } from "./session.js";
import { generatePkce } from "./sso.js";

export interface GoogleFlowDeps { exchange: typeof exchangeGoogleCode; verify: typeof verifyGoogleIdToken; jwks: () => JWTVerifyGetKey }
const realDeps: GoogleFlowDeps = { exchange: exchangeGoogleCode, verify: verifyGoogleIdToken, jwks: googleJwks };

export function startGoogleLogin(config: AppConfig): { url: string; oauthCookie: string } {
  const { verifier, challenge } = generatePkce();
  const state = randomBytes(16).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const url = buildGoogleAuthorizeUrl({ clientId: config.googleClientId, callbackUrl: config.googleCallbackUrl, state, challenge, nonce });
  const payload: OauthPayload = { state, verifier, nonce, iat: Math.floor(Date.now() / 1000) };
  return { url, oauthCookie: signPayload(payload, config.sessionSecret) };
}

const asAuthError = (e: unknown, fallback: "token" | "jwt") =>
  new AuthError(e instanceof GoogleError ? e.code : fallback, (e as Error).message);

export async function completeGoogleLogin(
  a: { code: string | null; state: string | null; error: string | null; oauthCookie: string | undefined },
  config: AppConfig, deps: GoogleFlowDeps = realDeps,
): Promise<GoogleIdentity> {
  if (a.error) throw new AuthError("cancelled", `Google sign-in was not completed: ${a.error}`);
  const saved = verifyPayload<OauthPayload>(a.oauthCookie, config.sessionSecret, OAUTH_MAX_AGE);
  if (!saved || !saved.nonce || !a.state || !a.code || saved.state !== a.state) throw new AuthError("state", "Google OAuth state mismatch or expired");
  let idToken: string;
  try {
    ({ idToken } = await deps.exchange({ clientId: config.googleClientId, clientSecret: config.googleClientSecret, callbackUrl: config.googleCallbackUrl, code: a.code, verifier: saved.verifier }));
  } catch (e) { throw asAuthError(e, "token"); }
  let identity: GoogleIdentity;
  try { identity = await deps.verify(idToken, { jwks: deps.jwks(), clientId: config.googleClientId, nonce: saved.nonce }); }
  catch (e) { throw asAuthError(e, "jwt"); }
  const email = identity.email.trim().toLowerCase();
  if (!config.allowedGoogleEmails.has(email)) {
    console.error("[auth] google account not allowed:", email);
    throw new AuthError("not-allowed", `Google account ${email} is not on the allow-list`);
  }
  return { sub: identity.sub, email };
}
