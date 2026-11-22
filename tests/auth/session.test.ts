import { describe, it, expect } from "vitest";
import { signPayload, verifyPayload, verifySession, withActiveCharacter } from "../../src/lib/auth/session.js";

describe("session tokens", () => {
  const s = "secret".repeat(6);
  it("signs and verifies", () => {
    const t = signPayload({ activeCharacterId: 5, iat: 1000 }, s);
    expect(verifyPayload<{ activeCharacterId: number }>(t, s, 3600, 2000)).toEqual({ activeCharacterId: 5, iat: 1000 });
  });
  it("rejects tamper, wrong secret, expiry, garbage", () => {
    const t = signPayload({ activeCharacterId: 5, iat: 1000 }, s);
    expect(verifyPayload(t + "x", s, 3600, 2000)).toBeNull();
    expect(verifyPayload(t, "nope".repeat(8), 3600, 2000)).toBeNull();
    expect(verifyPayload(t, s, 10, 2000)).toBeNull();
    expect(verifyPayload(undefined, s, 10, 2000)).toBeNull();
    expect(verifyPayload("a.b.c", s, 10, 2000)).toBeNull();
  });
});

describe("Google account sessions", () => {
  const s = "s".repeat(32);
  const allowed = new Set(["owner@example.com"]);
  it("accepts a session that names a Google account", () => {
    const t = signPayload({ sub: "g-1", email: "owner@example.com", activeCharacterId: 5, iat: 1000 }, s);
    expect(verifySession(t, s, allowed, 2000)).toEqual({ sub: "g-1", email: "owner@example.com", activeCharacterId: 5, iat: 1000 });
  });
  it("treats a pre-Google cookie as signed out", () => {
    expect(verifySession(signPayload({ activeCharacterId: 5, iat: 1000 }, s), s, allowed, 2000)).toBeNull();
    expect(verifySession(signPayload({ sub: "", email: "owner@example.com", activeCharacterId: 5, iat: 1000 }, s), s, allowed, 2000)).toBeNull();
  });
  it("signs out an account that has been taken off the allow-list", () => {
    const t = signPayload({ sub: "g-2", email: "second@example.com", activeCharacterId: 5, iat: 1000 }, s);
    expect(verifySession(t, s, new Set(["owner@example.com", "second@example.com"]), 2000)).not.toBeNull();
    expect(verifySession(t, s, allowed, 2000)).toBeNull();
    expect(verifySession(t, s, new Set(), 2000)).toBeNull();
  });
  it("keeps the account and the sign-in time when the active character changes", () => {
    expect(withActiveCharacter({ sub: "g-1", email: "owner@example.com", activeCharacterId: 5, iat: 1000 }, 9))
      .toEqual({ sub: "g-1", email: "owner@example.com", activeCharacterId: 9, iat: 1000 });
  });
});
