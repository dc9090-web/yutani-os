import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { ETAG_NOW, etagMatches, etagOf, respond, type Resource } from "../../../src/lib/api/v1/respond.js";

const request = (headers: Record<string, string> = {}) => new NextRequest("https://eve.example.com/api/v1/x", { headers });

describe("etagOf", () => {
  it("is a strong, quoted tag that follows the data and nothing else", () => {
    const tag = etagOf({ a: 1, b: ["x"] });
    expect(tag).toMatch(/^"[A-Za-z0-9_-]{32}"$/);
    expect(etagOf({ a: 1, b: ["x"] })).toBe(tag);
    expect(etagOf({ a: 2, b: ["x"] })).not.toBe(tag);
  });
});

describe("etagMatches", () => {
  it("matches the tag alone, in a list, weak-prefixed, or a star", () => {
    expect(etagMatches('"abc"', '"abc"')).toBe(true);
    expect(etagMatches('"zzz", "abc"', '"abc"')).toBe(true);
    expect(etagMatches('W/"abc"', '"abc"')).toBe(true);
    expect(etagMatches("*", '"abc"')).toBe(true);
  });
  it("does not match another tag or no header", () => {
    expect(etagMatches('"abd"', '"abc"')).toBe(false);
    expect(etagMatches(null, '"abc"')).toBe(false);
  });
});

describe("respond", () => {
  /** A resource with a clock string in it, like a training queue. */
  const ticking = (stored = "queue-1"): Resource => ({
    path: "/api/v1/x", clock: true,
    build: async (now) => ({ stored, remaining: `${now.getTime()} ms` }),
  });
  const noon = new Date("2026-03-14T12:00:00Z");
  const later = new Date("2026-03-15T09:30:00Z");

  it("wraps the data with generatedAt and sends its ETag", async () => {
    const res = await respond(request(), ticking(), noon);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { stored: "queue-1", remaining: `${noon.getTime()} ms` }, generatedAt: "2026-03-14T12:00:00.000Z" });
    expect(res.headers.get("etag")).toBe(etagOf({ stored: "queue-1", remaining: `${ETAG_NOW.getTime()} ms` }));
    expect(res.headers.get("cache-control")).toBe("private, no-cache");
  });

  it("keeps the tag as time passes, though the body moves on", async () => {
    const a = await respond(request(), ticking(), noon);
    const b = await respond(request(), ticking(), later);
    expect(b.headers.get("etag")).toBe(a.headers.get("etag"));
    expect(await b.json()).not.toEqual(await a.json());
  });

  it("changes the tag when the stored data changes", async () => {
    const a = await respond(request(), ticking("queue-1"), noon);
    const b = await respond(request(), ticking("queue-2"), noon);
    expect(b.headers.get("etag")).not.toBe(a.headers.get("etag"));
  });

  it("answers a matching If-None-Match with 304 and no body", async () => {
    const etag = (await respond(request(), ticking(), noon)).headers.get("etag")!;
    const res = await respond(request({ "if-none-match": etag }), ticking(), later);
    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe(etag);
    expect(await res.text()).toBe("");
  });

  it("sends the body again for a tag that no longer matches", async () => {
    const res = await respond(request({ "if-none-match": '"stale"' }), ticking(), noon);
    expect(res.status).toBe(200);
  });

  it("hashes a clock-free resource as built, without a second build", async () => {
    const build = vi.fn(async () => ({ rows: [1, 2, 3] }));
    const res = await respond(request(), { path: "/api/v1/x", clock: false, build }, noon);
    expect(build).toHaveBeenCalledTimes(1);
    expect(res.headers.get("etag")).toBe(etagOf({ rows: [1, 2, 3] }));
  });

  it("404s when there is no such thing", async () => {
    const res = await respond(request(), { path: "/api/v1/x", clock: false, build: async () => null }, noon);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "not-found" });
    expect(res.headers.get("etag")).toBeNull();
  });
});
