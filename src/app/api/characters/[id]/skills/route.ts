import { NextResponse, type NextRequest } from "next/server";
import { parseId } from "../../../../../lib/api/json.js";
import { getCharacter } from "../../../../../lib/db/characters.js";
import { listImplants } from "../../../../../lib/db/character-clones.js";
import { listSkills } from "../../../../../lib/db/character-skills.js";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Spec §3: the skills half of the browser engine's `FitContext`.
 * Trained level, not active level — the same rule `src/lib/ships/load.ts` records: the sheet answers
 * "can I fly this", and an unplugged clone does not untrain a skill.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if ((await getCharacter(id)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const [skills, implants] = await Promise.all([listSkills(id), listImplants(id)]);
  return NextResponse.json({
    skills: skills.map((s) => ({ skillId: s.skillId, level: s.trainedLevel })),
    implants,
  });
}
