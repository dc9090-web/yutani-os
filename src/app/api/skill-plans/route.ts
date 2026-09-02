import { NextResponse, type NextRequest } from "next/server";
import { createPlan, listPlans } from "../../../lib/db/skill-plans.js";
import { getCharacter } from "../../../lib/db/characters.js";
import { getCareerPlan } from "../../../lib/sde/repo.js";
import { summarisePlans } from "../../../lib/skills/load.js";
import { MAX_PLAN_ENTRIES, parsePlanCreate } from "../../../lib/skills/parse.js";
import { parseId } from "../../../lib/api/json.js";

const bad = () => NextResponse.json({ error: "bad request" }, { status: 400 });
const missing = () => NextResponse.json({ error: "not found" }, { status: 404 });

/** Spec §6: the plan list is always scoped to one character. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("characterId");
  const characterId = raw === null ? null : parseId(raw);
  if (characterId === null) return bad();
  const plans = await listPlans(characterId);
  return NextResponse.json({ plans: await summarisePlans(plans) });
}

export async function POST(req: NextRequest) {
  const input = parsePlanCreate(await req.json().catch(() => null));
  if (input === null) return bad();
  if ((await getCharacter(input.characterId)) === null) return missing();

  let entries = input.entries;
  if (input.templateId !== null) {
    const template = await getCareerPlan(input.templateId);
    if (template === null) return missing();
    // A career plan's own skill list is CCP's data, not user input, so `parsePlanEntries`'s
    // MAX_PLAN_ENTRIES check never runs on this path — clamp it here instead of letting an
    // oversized template silently write more rows than a client-built plan ever could.
    entries = template.skills.slice(0, MAX_PLAN_ENTRIES)
      .map((s) => ({ skillId: s.skillId, level: s.level, note: null }));
  }
  const plan = await createPlan({ characterId: input.characterId, name: input.name, entries });
  return NextResponse.json({ plan }, { status: 201 });
}
