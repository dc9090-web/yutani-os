import { NextResponse, type NextRequest } from "next/server";
import { createTag, listTags } from "../../../lib/db/tags.js";
import { parseTagName } from "../../../lib/api/json.js";
export async function GET() { return NextResponse.json(await listTags()); }
export async function POST(req: NextRequest) {
  const name = parseTagName(await req.json().catch(() => null));
  if (!name) return NextResponse.json({ error: "name required (1-30 chars)" }, { status: 400 });
  try {
    return NextResponse.json(await createTag(name), { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return NextResponse.json({ error: "a tag with that name exists" }, { status: 409 });
    throw e;
  }
}
