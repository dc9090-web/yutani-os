import { notFound } from "next/navigation";
import { parseId } from "../../../lib/api/json.js";
import { listCharacters } from "../../../lib/db/characters.js";
import { getFit } from "../../../lib/db/fits.js";
import { getTypeBonuses, getTypes } from "../../../lib/sde/repo.js";
import { bonusLabel } from "../../../lib/view/ships.js";
import { FitEditor } from "../FitEditor.js";

export default async function FitEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) notFound();

  const [fit, characters] = await Promise.all([getFit(id), listCharacters()]);
  if (fit === null) notFound();

  // Hull traits, read here because `getTypeBonuses` needs Postgres. The pilot can change without a
  // page load, so no skill level is shown beside a bonus (the fit sheet on /ships does show one).
  const bonuses = await getTypeBonuses(fit.shipTypeId);
  const skillIds = [...new Set(bonuses.map((b) => b.skillTypeId).filter((v): v is number => v !== null))];
  const skillTypes = await getTypes(skillIds);

  return (
    <FitEditor
      fit={{
        id: fit.id, name: fit.name, description: fit.description, shipTypeId: fit.shipTypeId,
        characterId: fit.characterId, items: fit.items,
      }}
      characters={characters.map((c) => ({ id: c.id, name: c.name }))}
      bonuses={bonuses.map((b) => ({
        skill: b.skillTypeId === null ? null : (skillTypes.get(b.skillTypeId)?.name ?? null),
        level: null,
        text: bonusLabel(b),
      }))}
    />
  );
}
