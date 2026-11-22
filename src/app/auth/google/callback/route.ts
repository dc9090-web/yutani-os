import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "../../../../lib/config.js";
import { AuthError } from "../../../../lib/auth/flow.js";
import { completeGoogleLogin } from "../../../../lib/auth/google-flow.js";
import { GOOGLE_OAUTH_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, signPayload, verifySession, type SessionPayload } from "../../../../lib/auth/session.js";

export async function GET(req: NextRequest) {
  const config = getConfig();
  const q = req.nextUrl.searchParams;
  try {
    const { sub, email } = await completeGoogleLogin(
      { code: q.get("code"), state: q.get("state"), error: q.get("error"), oauthCookie: req.cookies.get(GOOGLE_OAUTH_COOKIE)?.value }, config);
    const payload: SessionPayload = { sub, email, activeCharacterId: null, iat: Math.floor(Date.now() / 1000) };
    const res = NextResponse.redirect(new URL("/", config.siteOrigin));
    res.cookies.set(SESSION_COOKIE, signPayload(payload, config.sessionSecret), cookieOptions(SESSION_MAX_AGE));
    res.cookies.delete(GOOGLE_OAUTH_COOKIE);
    return res;
  } catch (e) {
    const code = e instanceof AuthError ? e.code : "unknown";
    console.error("[auth] google callback failed:", code, (e as Error).message);
    if (code === "state") {
      // A replayed callback (Back, reload, session restore) from an owner who is already signed in: go home.
      if (verifySession(req.cookies.get(SESSION_COOKIE)?.value, config.sessionSecret, config.allowedGoogleEmails)) {
        return NextResponse.redirect(new URL("/", config.siteOrigin));
      }
      // Leave the cookie alone: it may hold another tab's attempt, which can still finish.
      return NextResponse.redirect(new URL("/login?error=state", config.siteOrigin));
    }
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, config.siteOrigin));
    res.cookies.delete(GOOGLE_OAUTH_COOKIE);
    return res;
  }
}
