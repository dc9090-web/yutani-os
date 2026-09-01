import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { isPublicPath, proxy } from "../src/proxy.js";
import { SESSION_COOKIE, signPayload } from "../src/lib/auth/session.js";

describe("isPublicPath", () => {
  it("allows login, auth, health, static", () => {
    for (const p of ["/login", "/auth/start", "/auth/callback?code=1", "/api/health", "/_next/static/x.js", "/favicon.ico", "/eve-mark.svg"]) expect(isPublicPath(p)).toBe(true);
  });
  it("guards everything else", () => {
    for (const p of ["/", "/settings", "/api/accounts", "/ships/1", "/login-history", "/api/healthz"]) expect(isPublicPath(p)).toBe(false);
  });

  it("guards the wallet JSON route like every other API route", () => {
    expect(isPublicPath("/api/characters/669539978/wallet?kind=journal&offset=100")).toBe(false);
  });
});

describe("proxy", () => {
  const original = process.env.SESSION_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = original;
  });

  it("redirects to /login when SESSION_SECRET is unset", () => {
    delete process.env.SESSION_SECRET;
    const req = new NextRequest("https://eve.plasma66.com/settings");
    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://eve.plasma66.com/login");
  });

  it("passes through with a valid signed session cookie", () => {
    process.env.SESSION_SECRET = "s".repeat(32);
    const cookie = signPayload({ activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) }, process.env.SESSION_SECRET);
    const req = new NextRequest("https://eve.plasma66.com/settings");
    req.cookies.set(SESSION_COOKIE, cookie);
    const res = proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
