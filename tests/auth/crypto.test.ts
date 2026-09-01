import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "../../src/lib/auth/crypto.js";

describe("crypto", () => {
  const key = "session-secret-at-least-32-chars-long!!";
  it("round-trips and randomises IV", () => {
    const a = encryptSecret("refresh-token", key);
    const b = encryptSecret("refresh-token", key);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, key)).toBe("refresh-token");
  });
  it("rejects a wrong key and tampering", () => {
    const t = encryptSecret("x", key);
    expect(() => decryptSecret(t, "other-key-other-key-other-key-000")).toThrow();
    const parts = t.split(".");
    parts[3] = parts[3].slice(0, -2) + "AA";
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
  });
});
