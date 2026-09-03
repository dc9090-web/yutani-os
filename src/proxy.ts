import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, verifyPayload } from "./lib/auth/session.js";

const PUBLIC_EXACT = new Set(["/login", "/api/health"]);
const PUBLIC_PREFIXES = ["/auth/", "/_next/"];
const PUBLIC_FILES = new Set(["/favicon.ico", "/icon.svg", "/eve-mark.svg"]);

export function isPublicPath(pathname: string): boolean {
  const path = pathname.split("?")[0];
  return PUBLIC_FILES.has(path) || PUBLIC_EXACT.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

export function proxy(req: NextRequest) {
  if (isPublicPath(req.nextUrl.pathname)) return NextResponse.next();
  const secret = process.env.SESSION_SECRET;
  const ok = secret ? verifyPayload(req.cookies.get(SESSION_COOKIE)?.value, secret, SESSION_MAX_AGE) : null;
  if (ok) return NextResponse.next();
  const login = new URL("/login", req.nextUrl.origin);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
