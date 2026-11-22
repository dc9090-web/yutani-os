import type { NextRequest } from "next/server";
import type { JWTVerifyGetKey } from "jose";
import { getConfig, type AppConfig } from "../config.js";
import { createAppSession, findAppSession, touchAppSession } from "../db/app-sessions.js";
import { AuthError } from "./flow.js";
import { googleJwks, verifyGoogleIdToken } from "./google.js";
import { SESSION_COOKIE, verifySession } from "./session.js";

/** Who is calling `/api/v1`. `appSessionId` is set for a phone's bearer token, null for the site's cookie. */
export interface ApiIdentity { sub: string; email: string; appSessionId: number | null }

/** The token of an `Authorization: Bearer …` header; null when the header is absent or another scheme. */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match ? match[1] : null;
}

/**
 * A bearer token or the site's session cookie. A request that sends a bearer header is judged on it
 * alone, so a bad token is never rescued by a cookie. Either way the account must still be on
 * ALLOWED_GOOGLE_EMAILS: taking an address off the list signs its phones out too.
 */
export async function authenticateApi(req: NextRequest, config: AppConfig = getConfig()): Promise<ApiIdentity | null> {
  const authorization = req.headers.get("authorization");
  if (authorization !== null) {
    const token = bearerToken(authorization);
    const session = token === null ? null : await findAppSession(token);
    if (session === null || !config.allowedGoogleEmails.has(session.email.trim().toLowerCase())) return null;
    await touchAppSession(session.id);
    return { sub: session.sub, email: session.email, appSessionId: session.id };
  }
  const cookie = verifySession(req.cookies.get(SESSION_COOKIE)?.value, config.sessionSecret, config.allowedGoogleEmails);
  return cookie === null ? null : { sub: cookie.sub, email: cookie.email, appSessionId: null };
}

/** 1–80 characters after trimming; null for anything else. */
export function parseDeviceName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length >= 1 && name.length <= 80 ? name : null;
}

/** Google's signing keys could not be reached; the caller should answer 503, not "invalid token". */
export class KeysUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "KeysUnavailableError"; }
}

// jose reports a slow key fetch as ERR_JWKS_TIMEOUT; a failed one surfaces as fetch's own TypeError.
function keysUnavailable(e: unknown): boolean {
  return e instanceof TypeError || (e as { code?: unknown } | null)?.code === "ERR_JWKS_TIMEOUT";
}

export interface AppLoginDeps { verify: typeof verifyGoogleIdToken; jwks: () => JWTVerifyGetKey }
const realDeps: AppLoginDeps = { verify: verifyGoogleIdToken, jwks: googleJwks };

/**
 * The phone's sign-in: Android's Credential Manager hands the app a Google ID token minted for the
 * web client ID, and this trades it for an app session. Same checks as the web callback except the
 * nonce — there is no redirect here to bind one to. Throws AuthError "jwt" or "not-allowed", or
 * KeysUnavailableError when Google's keys cannot be fetched.
 */
export async function appGoogleLogin(
  a: { idToken: string; deviceName: string }, config: AppConfig = getConfig(), deps: AppLoginDeps = realDeps,
): Promise<{ token: string; email: string }> {
  let identity;
  try { identity = await deps.verify(a.idToken, { jwks: deps.jwks(), clientId: config.googleClientId }); }
  catch (e) {
    // Google's keys could not be fetched: the token was never judged, so this is not the phone's fault.
    if (keysUnavailable(e)) throw new KeysUnavailableError((e as Error).message);
    throw new AuthError("jwt", (e as Error).message);
  }
  const email = identity.email.trim().toLowerCase();
  if (!config.allowedGoogleEmails.has(email)) {
    console.error("[auth] google account not allowed:", email);
    throw new AuthError("not-allowed", `Google account ${email} is not on the allow-list`);
  }
  const { token } = await createAppSession({ sub: identity.sub, email, deviceName: a.deviceName });
  return { token, email };
}
