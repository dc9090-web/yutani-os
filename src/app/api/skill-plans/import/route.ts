import { NextResponse, type NextRequest } from "next/server";
import { getCharacter } from "../../../../lib/db/characters.js";
import { createPlan } from "../../../../lib/db/skill-plans.js";
import { loadSkillCatalogue } from "../../../../lib/skills/load.js";
import { MAX_PLAN_ENTRIES, parsePlanImport } from "../../../../lib/skills/parse.js";
import { resolvePlanLines, tokenisePlanText } from "../../../../lib/skills/text.js";

/**
 * Spec §6. Names resolve against the SKILL CATALOGUE, not every SDE type: matching all types by
 * name would happily turn "200mm AutoCannon II" into a plan entry.
 */
export async function POST(req: NextRequest) {
  const input = parsePlanImport(await req.json().catch(() => null));
  if (input === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if ((await getCharacter(input.characterId)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const catalogue = await loadSkillCatalogue();
  const byName = new Map(catalogue.map((s) => [s.name.toLowerCase(), s.id]));
  const parsed = resolvePlanLines(tokenisePlanText(input.text), byName);

  const entries = parsed.entries.slice(0, MAX_PLAN_ENTRIES)
    .map((e) => ({ skillId: e.skillId, level: e.level, note: null }));
  const overflow = parsed.entries.length - entries.length;
  const unresolved = overflow > 0
    ? [...parsed.unresolved, `… and ${overflow} more lines (a plan holds at most ${MAX_PLAN_ENTRIES} entries)`]
    : parsed.unresolved;

  const plan = await createPlan({ characterId: input.characterId, name: input.name, entries });
  return NextResponse.json({ plan, unresolved }, { status: 201 });
}
