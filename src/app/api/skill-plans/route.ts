import { NextResponse, type NextRequest } from "next/server";
import { createPlan, listPlans } from "../../../lib/db/skill-plans.js";
import { getCharacter } from "../../../lib/db/characters.js";
import { getCareerPlan } from "../../../lib/sde/repo.js";
import { summarisePlans } from "../../../lib/skills/load.js";
import { parsePlanCreate } from "../../../lib/skills/parse.js";

const bad = () => NextResponse.json({ error: "bad request" }, { status: 400 });
const missing = () => NextResponse.json({ error: "not found" }, { status: 404 });

/** Spec §6: the plan list is always scoped to one character. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("characterId");
  const characterId = raw === null ? NaN : Number(raw);
  if (!Number.isInteger(characterId) || characterId <= 0) return bad();
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
    entries = template.skills.map((s) => ({ skillId: s.skillId, level: s.level, note: null }));
  }
  const plan = await createPlan({ characterId: input.characterId, name: input.name, entries });
  return NextResponse.json({ plan }, { status: 201 });
}
