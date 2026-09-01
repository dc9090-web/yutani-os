import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, verifyPayload } from "./lib/auth/session.js";

const PUBLIC_PREFIXES = ["/login", "/auth/", "/api/health", "/_next/"];
const PUBLIC_FILES = new Set(["/favicon.ico", "/eve-mark.svg"]);

export function isPublicPath(pathname: string): boolean {
  const path = pathname.split("?")[0];
  return PUBLIC_FILES.has(path) || PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p));
}

export function proxy(req: NextRequest) {
  if (isPublicPath(req.nextUrl.pathname)) return NextResponse.next();
  const ok = verifyPayload(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET ?? "", SESSION_MAX_AGE);
  if (ok) return NextResponse.next();
  const login = new URL("/login", req.nextUrl.origin);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
