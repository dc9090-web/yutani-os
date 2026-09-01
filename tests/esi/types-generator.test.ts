import { describe, it, expect, vi } from "vitest";
import { SPEC, COMPATIBILITY_DATE, specFetch } from "../../scripts/esi-types.js";

/** The generator must never hit the network in tests — specFetch is exercised with a fake. */
function recorder() {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: { ...((init?.headers ?? {}) as Record<string, string>) } });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

describe("esi-types generator", () => {
  it("pins the published compatibility date and the spec URL", () => {
    expect(COMPATIBILITY_DATE).toBe("2026-08-18");
    expect(SPEC).toBe("https://esi.evetech.net/meta/openapi.json");
  });
  it("sends X-Compatibility-Date when fetching the spec", async () => {
    const { calls, impl } = recorder();
    await specFetch(impl)(SPEC);
    expect(calls[0].url).toBe(SPEC);
    expect(calls[0].headers["X-Compatibility-Date"]).toBe("2026-08-18");
  });
  it("keeps headers the caller already set", async () => {
    const { calls, impl } = recorder();
    await specFetch(impl)(SPEC, { headers: { Accept: "application/json" } });
    expect(calls[0].headers.Accept).toBe("application/json");
    expect(calls[0].headers["X-Compatibility-Date"]).toBe("2026-08-18");
  });
});
