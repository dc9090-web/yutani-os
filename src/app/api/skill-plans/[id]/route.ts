import { NextResponse, type NextRequest } from "next/server";
import { parseId } from "../../../../lib/api/json.js";
import { deletePlan, getPlan, updatePlan } from "../../../../lib/db/skill-plans.js";
import { computePlan } from "../../../../lib/skills/load.js";
import { parsePlanPatch } from "../../../../lib/skills/parse.js";

type Ctx = { params: Promise<{ id: string }> };

const bad = () => NextResponse.json({ error: "bad request" }, { status: 400 });
const missing = () => NextResponse.json({ error: "not found" }, { status: 404 });

/** "1" and "true" both switch the timeline's start to the end of the ESI queue (spec §5). */
function afterQueueFlag(req: NextRequest): boolean {
  const raw = req.nextUrl.searchParams.get("afterQueue");
  return raw === "1" || raw === "true";
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return bad();
  const plan = await getPlan(id);
  if (plan === null) return missing();
  const computed = await computePlan(plan, { afterQueue: afterQueueFlag(req) });
  return NextResponse.json({ plan, timeline: computed.timeline, startAt: computed.startAt });
}

/** Spec §6: entries are replaced wholesale, then re-expanded server-side for the response. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return bad();
  const patch = parsePlanPatch(await req.json().catch(() => null));
  if (patch === null) return bad();
  const plan = await updatePlan(id, patch);
  if (plan === null) return missing();
  const computed = await computePlan(plan, { afterQueue: afterQueueFlag(req) });
  return NextResponse.json({ plan, timeline: computed.timeline, startAt: computed.startAt });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return bad();
  if (!(await deletePlan(id))) return missing();
  return new NextResponse(null, { status: 204 });
}
