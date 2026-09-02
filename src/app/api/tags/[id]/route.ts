import { NextResponse, type NextRequest } from "next/server";
import { deleteTag } from "../../../../lib/db/tags.js";
import { parseId } from "../../../../lib/api/json.js";
type Ctx = { params: Promise<{ id: string }> };
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await deleteTag(id);
  return new NextResponse(null, { status: 204 });
}
