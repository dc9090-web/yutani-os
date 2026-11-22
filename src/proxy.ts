import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/auth/session.js";

const PUBLIC_EXACT = new Set(["/login", "/api/health"]);
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
  const ok = secret ? verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret) : null;
  if (ok) return NextResponse.next();
  const login = new URL("/login", req.nextUrl.origin);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
