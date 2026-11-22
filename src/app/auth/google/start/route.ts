import { NextResponse } from "next/server";
import { getConfig } from "../../../../lib/config.js";
import { startGoogleLogin } from "../../../../lib/auth/google-flow.js";
import { GOOGLE_OAUTH_COOKIE, OAUTH_MAX_AGE, cookieOptions } from "../../../../lib/auth/session.js";

export async function GET() {
  const { url, oauthCookie } = startGoogleLogin(getConfig());
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_OAUTH_COOKIE, oauthCookie, cookieOptions(OAUTH_MAX_AGE));
  return res;
}
