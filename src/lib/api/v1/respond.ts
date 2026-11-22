import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export const API_VERSION = 1;

/**
 * The clock every ETag is worked out against. A resource with clock strings in it ("3h 12m left")
 * would otherwise get a new tag every minute; built against this fixed moment the strings come out
 * the same every time, so the tag moves only when the stored data does. The epoch, so nothing in a
 * skill queue has finished yet and the tag covers every stored entry.
 */
export const ETAG_NOW = new Date(0);

/**
 * One thing the phone keeps a copy of. `clock` says whether `build` reads its `now`: a resource
 * that does is built a second time against ETAG_NOW for its tag; one that does not is hashed as is.
 * `build` returns null for "no such thing" (a ship the character does not own).
 */
export interface Resource<T = unknown> {
  /** The exact path and query the client GETs. */
  path: string;
  clock: boolean;
  build(now: Date): Promise<T | null>;
}

/** A strong ETag over the data alone — `generatedAt` is not part of it. */
export function etagOf(data: unknown): string {
  return `"${createHash("sha256").update(JSON.stringify(data)).digest("base64url").slice(0, 32)}"`;
}

/** The tag for a resource whose `data` (built against the real clock) is already in hand. */
export async function resourceEtag(resource: Resource, data: unknown): Promise<string> {
  return etagOf(resource.clock ? await resource.build(ETAG_NOW) : data);
}

/** RFC 9110 §13.1.2: a list of tags or `*`, compared weakly (a `W/` prefix is ignored). */
export function etagMatches(header: string | null, etag: string): boolean {
  if (header === null) return false;
  return header.split(",").map((part) => part.trim().replace(/^W\//, "")).some((tag) => tag === "*" || tag === etag);
}

export function v1Error(status: 400 | 401 | 404, code: "bad-id" | "bad-request" | "unauthorised" | "not-found"): NextResponse {
  return NextResponse.json({ error: code }, { status });
}

// The copy is the phone's own; nothing in between may keep one.
const HEADERS = { "Cache-Control": "private, no-cache" };

/** `{ data, generatedAt }` with its ETag, or 304 with no body when the caller already holds that tag. */
export async function respond(req: NextRequest, resource: Resource, now: Date = new Date()): Promise<NextResponse> {
  const data = await resource.build(now);
  if (data === null) return v1Error(404, "not-found");
  const etag = await resourceEtag(resource, data);
  if (etagMatches(req.headers.get("if-none-match"), etag)) {
    return new NextResponse(null, { status: 304, headers: { ...HEADERS, ETag: etag } });
  }
  return NextResponse.json({ data, generatedAt: now.toISOString() }, { headers: { ...HEADERS, ETag: etag } });
}
