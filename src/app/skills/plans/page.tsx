import Link from "next/link";
import { readSession } from "../../../lib/auth/session.js";
import { listCharacters } from "../../../lib/db/characters.js";
import { listPlans } from "../../../lib/db/skill-plans.js";
import { listCareerPlans } from "../../../lib/sde/repo.js";
import { summarisePlans } from "../../../lib/skills/load.js";
import { pickActive } from "../../../lib/view/characters.js";
import { duration, stamp } from "../../../lib/view/format.js";
import { CharacterPicker } from "../../components/CharacterPicker.js";
import { NoCharacter } from "../../components/NoCharacter.js";
import { PageHead } from "../../components/PageHead.js";
import { PlansCard, type PlanListRow } from "../PlansCard.js";

/**
 * Skill plans for the active character. The redesign took the Plans card off the Skills page's
 * Training tab (PAGES.md §2) without giving the planner a new entry point, so the same card lives
 * here, linked from that tab. The plan editor itself is /skills/plans/[id].
 */
export default async function SkillPlansPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Skill plans" />;

  const [storedPlans, templates] = await Promise.all([listPlans(character.id), listCareerPlans()]);
  const planRows: PlanListRow[] = (await summarisePlans(storedPlans)).map((plan) => ({
    id: plan.id,
    name: plan.name,
    entries: plan.entryCount,
    remaining: duration(plan.totalMs),
    doneAt: stamp(plan.doneAt),
  }));

  return (<>
    <Link href="/skills#training" className="yo-back">Training queue</Link>
    <PageHead title="Skill plans">
      <CharacterPicker characters={characters} activeId={character.id} />
    </PageHead>
    <PlansCard
      characterId={character.id}
      plans={planRows}
      templates={templates.map((t) => ({ id: t.id, name: t.name ?? `Plan ${t.id}` }))}
    />
  </>);
}
