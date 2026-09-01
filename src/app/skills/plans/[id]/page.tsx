import { notFound } from "next/navigation";
import { parseId } from "../../../../lib/api/json.js";
import { getPlan } from "../../../../lib/db/skill-plans.js";
import { accountTrainingBlock, loadPlanContext, loadSkillCatalogue } from "../../../../lib/skills/load.js";
import { PlanEditor } from "../../PlanEditor.js";

export default async function PlanEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) notFound();

  const plan = await getPlan(id);
  if (plan === null) notFound();

  const [catalogue, context, accountBlock] = await Promise.all([
    loadSkillCatalogue(), loadPlanContext(plan.characterId), accountTrainingBlock(plan.characterId),
  ]);

  return (<>
    <h1 className="page-title">Skill plan</h1>
    <PlanEditor
      key={plan.id}
      plan={{
        id: plan.id, characterId: plan.characterId, name: plan.name, remap: plan.remap,
        entries: plan.entries.map((e) => ({ skillId: e.skillId, level: e.level, note: e.note })),
      }}
      characterName={context.characterName}
      catalogue={catalogue}
      // Maps and Dates do not cross the server/client boundary: tuples and ISO strings do.
      context={{
        base: context.base, implantBonus: context.implantBonus,
        trained: [...context.trained], queued: [...context.queued], partialSp: [...context.partialSp],
        queueEndsAt: context.queueEndsAt?.toISOString() ?? null,
        bonusRemaps: context.bonusRemaps,
        accruedRemapCooldownDate: context.accruedRemapCooldownDate?.toISOString() ?? null,
        attributesSane: context.attributesSane, synced: context.synced,
      }}
      accountBlock={accountBlock === null
        ? null : { name: accountBlock.name, until: accountBlock.until.toISOString() }}
    />
  </>);
}
