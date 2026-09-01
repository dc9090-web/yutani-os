import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchLatestBuild, sdeUserAgent, SDE_LATEST_URL } from "../../src/lib/sde/version.js";

const LATEST_LINE = '{"_key": "sde", "buildNumber": 3484357, "releaseDate": "2026-08-28T11:07:12Z"}\n';

afterEach(() => { delete process.env.ESI_USER_AGENT; });

describe("fetchLatestBuild", () => {
  it("parses the single-line build pointer and identifies itself", async () => {
    process.env.ESI_USER_AGENT = "EVE-Plasma/0.1 (dac9dc@gmail.com)";
    const fetchImpl = vi.fn(async () => new Response(LATEST_LINE, { status: 200 }));
    const build = await fetchLatestBuild(fetchImpl as unknown as typeof fetch);
    expect(build.buildNumber).toBe(3484357);
    expect(build.releaseDate.toISOString()).toBe("2026-08-28T11:07:12.000Z");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SDE_LATEST_URL);
    expect((init.headers as Record<string, string>)["user-agent"]).toBe("EVE-Plasma/0.1 (dac9dc@gmail.com)");
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503, statusText: "Service Unavailable" }));
    await expect(fetchLatestBuild(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/503/);
  });

  it("throws on an empty or unexpected body", async () => {
    const empty = vi.fn(async () => new Response("\n", { status: 200 }));
    await expect(fetchLatestBuild(empty as unknown as typeof fetch)).rejects.toThrow(/empty/i);
    const junk = vi.fn(async () => new Response('{"_key":"sde"}\n', { status: 200 }));
    await expect(fetchLatestBuild(junk as unknown as typeof fetch)).rejects.toThrow(/unexpected/i);
  });

  it("throws on an invalid releaseDate", async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{"_key": "sde", "buildNumber": 3484357, "releaseDate": "not-a-date"}\n', { status: 200 }),
    );
    await expect(fetchLatestBuild(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/invalid releaseDate/i);
  });

  it("throws on a non-positive-integer buildNumber", async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{"_key": "sde", "buildNumber": -1, "releaseDate": "2026-08-28T11:07:12Z"}\n', { status: 200 }),
    );
    await expect(fetchLatestBuild(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/invalid buildNumber/i);
  });

  it("falls back to a default user agent", () => {
    expect(sdeUserAgent()).toBe("EVE-Plasma (dac9dc@gmail.com)");
  });
});
