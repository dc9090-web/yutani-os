import { describe, it, expect } from "vitest";
import { isPublicPath } from "../src/proxy.js";
describe("isPublicPath", () => {
  it("allows login, auth, health, static", () => {
    for (const p of ["/login", "/auth/start", "/auth/callback?code=1", "/api/health", "/_next/static/x.js", "/favicon.ico", "/eve-mark.svg"]) expect(isPublicPath(p)).toBe(true);
  });
  it("guards everything else", () => {
    for (const p of ["/", "/settings", "/api/accounts", "/ships/1", "/login-history", "/api/healthz"]) expect(isPublicPath(p)).toBe(false);
  });
});
