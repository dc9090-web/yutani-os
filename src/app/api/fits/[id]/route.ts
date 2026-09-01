import { NextResponse, type NextRequest } from "next/server";
import { parseId } from "../../../../lib/api/json.js";
import { deleteFit, getFit, updateFit } from "../../../../lib/db/fits.js";
import { parseFitPatch } from "../../../../lib/fits/parse.js";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const fit = await getFit(id);
  if (fit === null) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ fit });
}

/** Spec §6: items are replaced wholesale; a patch without `items` leaves them alone. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const patch = parseFitPatch(await req.json().catch(() => null));
  if (patch === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const fit = await updateFit(id, patch);
  if (fit === null) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ fit });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (!(await deleteFit(id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
