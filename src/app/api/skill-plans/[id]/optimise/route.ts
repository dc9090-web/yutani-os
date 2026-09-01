import { NextResponse, type NextRequest } from "next/server";
import { parseId } from "../../../../../lib/api/json.js";
import { getPlan } from "../../../../../lib/db/skill-plans.js";
import { catalogueFrom } from "../../../../../lib/skills/catalogue.js";
import { computePlan } from "../../../../../lib/skills/load.js";
import { optimalRemap } from "../../../../../lib/skills/remap.js";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Spec §6. A POST because it is an expensive pure computation with no cacheable identity — it
 * writes nothing; the client decides whether to PUT the remap it gets back.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const plan = await getPlan(id);
  if (plan === null) return NextResponse.json({ error: "not found" }, { status: 404 });

  const computed = await computePlan(plan);
  const result = optimalRemap({
    entries: computed.entries,
    catalogue: catalogueFrom(computed.catalogue),
    currentBase: computed.context.base,
    implantBonus: computed.context.implantBonus,
    trained: computed.context.trained,
    queued: computed.context.queued,
    partialSp: computed.context.partialSp,
  });
  return NextResponse.json(result);
}
