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
