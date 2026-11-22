import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { isPublicPath, proxy } from "../src/proxy.js";
import { SESSION_COOKIE, signPayload } from "../src/lib/auth/session.js";

describe("isPublicPath", () => {
  it("allows login, auth, health, static", () => {
    for (const p of ["/login", "/auth/google/start", "/auth/google/callback?code=1", "/api/health", "/api/v1/auth/google", "/_next/static/x.js", "/favicon.ico", "/icon.svg", "/eve-mark.svg", "/yutani/wordmark-white.png", "/yutani/kana-white.png"]) expect(isPublicPath(p)).toBe(true);
  });
  it("guards everything else", () => {
    for (const p of ["/", "/settings", "/yutani", "/yutanix/x.png", "/api/accounts", "/ships/1", "/login-history", "/api/healthz", "/auth/start", "/auth/callback?code=1", "/auth/googlex", "/auth/switch", "/api/v1/me", "/api/v1/auth/session", "/api/v1/auth/googlex", "/api/v1/characters/1/skills"]) expect(isPublicPath(p)).toBe(false);
  });

  it("guards the wallet JSON route like every other API route", () => {
    expect(isPublicPath("/api/characters/669539978/wallet?kind=journal&offset=100")).toBe(false);
  });
});

describe("proxy", () => {
  const original = process.env.SESSION_SECRET;
  const originalEmails = process.env.ALLOWED_GOOGLE_EMAILS;
  beforeEach(() => { process.env.ALLOWED_GOOGLE_EMAILS = "Owner@Example.com"; });
  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = original;
    if (originalEmails === undefined) delete process.env.ALLOWED_GOOGLE_EMAILS; else process.env.ALLOWED_GOOGLE_EMAILS = originalEmails;
  });

  it("redirects to /login when SESSION_SECRET is unset", () => {
    delete process.env.SESSION_SECRET;
    const req = new NextRequest("https://eve.example.com/settings");
    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://eve.example.com/login");
  });

  it("passes through with a valid signed session cookie", () => {
    process.env.SESSION_SECRET = "s".repeat(32);
    const cookie = signPayload({ sub: "g-1", email: "owner@example.com", activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) }, process.env.SESSION_SECRET);
    const req = new NextRequest("https://eve.example.com/settings");
    req.cookies.set(SESSION_COOKIE, cookie);
    const res = proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends a pre-Google session cookie to /login", () => {
    process.env.SESSION_SECRET = "s".repeat(32);
    const req = new NextRequest("https://eve.example.com/settings");
    req.cookies.set(SESSION_COOKIE, signPayload({ activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) }, process.env.SESSION_SECRET));
    expect(proxy(req).headers.get("location")).toBe("https://eve.example.com/login");
  });

  it("sends a session for an account no longer on the allow-list to /login", () => {
    process.env.SESSION_SECRET = "s".repeat(32);
    const req = new NextRequest("https://eve.example.com/settings");
    req.cookies.set(SESSION_COOKIE, signPayload({ sub: "g-2", email: "second@example.com", activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) }, process.env.SESSION_SECRET));
    expect(proxy(req).headers.get("location")).toBe("https://eve.example.com/login");
  });

  it("sends every session to /login when ALLOWED_GOOGLE_EMAILS is unset", () => {
    process.env.SESSION_SECRET = "s".repeat(32);
    delete process.env.ALLOWED_GOOGLE_EMAILS;
    const req = new NextRequest("https://eve.example.com/settings");
    req.cookies.set(SESSION_COOKIE, signPayload({ sub: "g-1", email: "owner@example.com", activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) }, process.env.SESSION_SECRET));
    expect(proxy(req).headers.get("location")).toBe("https://eve.example.com/login");
  });

  describe("/api/v1", () => {
    const signed = () => signPayload({ sub: "g-1", email: "owner@example.com", activeCharacterId: 1, iat: Math.floor(Date.now() / 1000) }, process.env.SESSION_SECRET!);
    beforeEach(() => { process.env.SESSION_SECRET = "s".repeat(32); });

    it("answers an unauthenticated request with 401 JSON, never a redirect", async () => {
      const res = proxy(new NextRequest("https://eve.example.com/api/v1/overview"));
      expect(res.status).toBe(401);
      expect(res.headers.get("location")).toBeNull();
      await expect(res.json()).resolves.toEqual({ error: "unauthorised" });
    });

    it("lets a bearer header through for the route to verify", () => {
      const req = new NextRequest("https://eve.example.com/api/v1/overview", { headers: { authorization: "Bearer some-token" } });
      expect(proxy(req).status).toBe(200);
    });

    it("does not let an empty or non-bearer Authorization header through", () => {
      for (const authorization of ["Bearer", "Bearer ", "Basic abc"]) {
        const req = new NextRequest("https://eve.example.com/api/v1/overview", { headers: { authorization } });
        expect(proxy(req).status).toBe(401);
      }
    });

    it("lets the site's own cookie through", () => {
      const req = new NextRequest("https://eve.example.com/api/v1/overview");
      req.cookies.set(SESSION_COOKIE, signed());
      expect(proxy(req).status).toBe(200);
    });

    it("401s a cookie whose account is off the allow-list", () => {
      process.env.ALLOWED_GOOGLE_EMAILS = "someone-else@example.com";
      const req = new NextRequest("https://eve.example.com/api/v1/overview");
      req.cookies.set(SESSION_COOKIE, signed());
      expect(proxy(req).status).toBe(401);
    });

    it("lets the sign-in route through with nothing at all", () => {
      expect(proxy(new NextRequest("https://eve.example.com/api/v1/auth/google", { method: "POST" })).status).toBe(200);
    });

    it("a bearer header opens nothing outside /api/v1", () => {
      const req = new NextRequest("https://eve.example.com/api/accounts", { headers: { authorization: "Bearer some-token" } });
      expect(proxy(req).headers.get("location")).toBe("https://eve.example.com/login");
    });
  });
});
