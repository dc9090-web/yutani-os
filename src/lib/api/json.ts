export function parseName(body: unknown): string | null {
  const raw = (body as { name?: unknown } | null)?.name;
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length >= 1 && name.length <= 40 ? name : null;
}
export function parseAccountId(body: unknown): number | null | undefined {
  if (!body || typeof body !== "object" || !("accountId" in body)) return undefined;
  const v = (body as { accountId: unknown }).accountId;
  if (v === null) return null;
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined;
}
export function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Spec §3: up to 200 ids per `/api/dogma/types` request. Exported (not a route-local const) so
 * Task 12's browser store can chunk to the same ceiling the route enforces, from a module with no
 * server-only imports.
 */
export const MAX_IDS = 200;

/**
 * A comma-separated id list from a query string. Positive integers only, deduplicated, order kept.
 * `null` means "reject with a 400" — an absent list, an empty one, rubbish or more than `max` ids.
 */
export function parseIdList(raw: string | null, max: number): number[] | null {
  if (raw === null) return null;
  const parts = raw.split(",").map((p) => p.trim()).filter((p) => p !== "");
  if (parts.length === 0 || parts.length > max) return null;
  const seen = new Set<number>();
  for (const part of parts) {
    const id = Number(part);
    if (!Number.isInteger(id) || id <= 0) return null;
    seen.add(id);
  }
  return [...seen];
}
