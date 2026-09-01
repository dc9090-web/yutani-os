import { describe, it, expect } from "vitest";
import { signPayload, verifyPayload } from "../../src/lib/auth/session.js";

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
