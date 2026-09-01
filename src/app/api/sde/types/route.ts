import { NextResponse, type NextRequest } from "next/server";
import { browseTypes, getMetaGroups } from "../../../../lib/sde/repo.js";

const DEFAULT_LIMIT = 50;
/** category=16&limit=1000 is the "All skills V" id fetch (spec §3); nothing needs more. */
const MAX_LIMIT = 1000;
const MAX_QUERY = 64;

function parsePositive(raw: string | null): number | null | undefined {
  if (raw === null) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function parseCategories(raw: string | null): number[] | null | undefined {
  if (raw === null) return undefined;
  const parts = raw.split(",").map((p) => p.trim()).filter((p) => p !== "");
  if (parts.length === 0) return null;
  const out: number[] = [];
  for (const part of parts) {
    const id = Number(part);
    if (!Number.isInteger(id) || id <= 0) return null;
    out.push(id);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const rawQuery = params.get("q");
  const q = rawQuery === null || rawQuery.trim() === "" ? undefined : rawQuery.trim();
  const categoryIds = parseCategories(params.get("category"));
  const marketGroupId = parsePositive(params.get("marketGroup"));
  const limitRaw = parsePositive(params.get("limit"));
  if (categoryIds === null || marketGroupId === null || limitRaw === null) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const limit = limitRaw ?? DEFAULT_LIMIT;
  if (limit > MAX_LIMIT || (q !== undefined && q.length > MAX_QUERY)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // A browse with no filter at all would page the whole SDE: that is a client bug, not a query.
  if (q === undefined && categoryIds === undefined && marketGroupId === undefined) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const [types, metaGroups] = await Promise.all([
    browseTypes({ q, categoryIds, marketGroupId, limit }),
    getMetaGroups(),
  ]);
  return NextResponse.json({
    types: types.map((t) => ({
      id: t.id, name: t.name, groupId: t.groupId, categoryId: t.categoryId,
      marketGroupId: t.marketGroupId,
      metaGroup: t.metaGroupId === null ? null : (metaGroups.get(t.metaGroupId) ?? null),
      metaLevel: t.metaLevel,
    })),
  });
}
