import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/auth/session.js";
import { parseAllowedEmails } from "./lib/config.js";

// /api/v1/auth/google is where a phone trades a Google ID token for its bearer token.
const PUBLIC_EXACT = new Set(["/login", "/api/health", "/api/v1/auth/google"]);
const API_V1_PREFIX = "/api/v1/";
// /yutani/ holds the brand images the bare login page shows before there is a session.
// Only the Google sign-in routes are public; the EVE routes (/auth/start, /auth/callback, /auth/switch, /auth/logout) need a session.
const PUBLIC_PREFIXES = ["/auth/google/", "/_next/", "/yutani/"];
const PUBLIC_FILES = new Set(["/favicon.ico", "/icon.svg", "/eve-mark.svg"]);

export function isPublicPath(pathname: string): boolean {
  const path = pathname.split("?")[0];
  return PUBLIC_FILES.has(path) || PUBLIC_EXACT.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

export function proxy(req: NextRequest) {
  if (isPublicPath(req.nextUrl.pathname)) return NextResponse.next();
  const secret = process.env.SESSION_SECRET;
  // An account taken off ALLOWED_GOOGLE_EMAILS is signed out on its next request; an unset list lets no one in.
  const ok = secret ? verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret, parseAllowedEmails(process.env.ALLOWED_GOOGLE_EMAILS)) : null;
  if (ok) return NextResponse.next();
  // The phone's API answers in JSON, never with a redirect to a login page it cannot use. A bearer
  // token needs the database, which the proxy does not have: the route verifies it (authenticateApi).
  if (req.nextUrl.pathname.startsWith(API_V1_PREFIX)) {
    if (/^Bearer\s+\S/i.test(req.headers.get("authorization") ?? "")) return NextResponse.next();
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const login = new URL("/login", req.nextUrl.origin);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
