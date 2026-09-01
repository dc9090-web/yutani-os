import { NextResponse, type NextRequest } from "next/server";
import { parseId } from "../../../../../lib/api/json.js";
import { getPlan } from "../../../../../lib/db/skill-plans.js";
import { catalogueFrom } from "../../../../../lib/skills/catalogue.js";
import { computePlan } from "../../../../../lib/skills/load.js";
import { exportPlanText, isPlanTextFormat } from "../../../../../lib/skills/text.js";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Spec §5/§6. The expanded plan minus what the character has already trained: prerequisites are
 * real training and belong in the text, and so does anything the queue has not delivered yet.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const raw = req.nextUrl.searchParams.get("format") ?? "evemon";
  if (!isPlanTextFormat(raw)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const plan = await getPlan(id);
  if (plan === null) return NextResponse.json({ error: "not found" }, { status: 404 });

  const computed = await computePlan(plan);
  const entries = computed.timeline.entries.filter((e) => e.status !== "done");
  const text = exportPlanText(entries, catalogueFrom(computed.catalogue), raw);
  return new NextResponse(text, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
