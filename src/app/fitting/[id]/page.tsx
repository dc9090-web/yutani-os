import { notFound } from "next/navigation";
import { parseId } from "../../../lib/api/json.js";
import { listCharacters } from "../../../lib/db/characters.js";
import { getFit } from "../../../lib/db/fits.js";
import { getGroups, getRaces, getTypeBonuses, getTypes } from "../../../lib/sde/repo.js";
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

  // Ship-identity pills (design hand-back part A) need the hull's race + group name. The hull id is
  // batched into the same `getTypes` read the skill names already use — no second `getTypes` round
  // trip — and race/group id -> name is one more small wave, the same two-step `/ships`
  // (`ShipCard.tsx`, `assetShipCards`/`savedFitCards`) already takes.
  const types = await getTypes([fit.shipTypeId, ...skillIds]);
  const hullType = types.get(fit.shipTypeId) ?? null;
  const [races, groups] = await Promise.all([
    getRaces(),
    getGroups(hullType?.groupId == null ? [] : [hullType.groupId]),
  ]);

  return (
    <FitEditor
      key={fit.id}
      fit={{
        id: fit.id, name: fit.name, description: fit.description, shipTypeId: fit.shipTypeId,
        characterId: fit.characterId, items: fit.items,
      }}
      characters={characters.map((c) => ({ id: c.id, name: c.name }))}
      bonuses={bonuses.map((b) => ({
        skill: b.skillTypeId === null ? null : (types.get(b.skillTypeId)?.name ?? null),
        level: null,
        text: bonusLabel(b),
      }))}
      ship={{
        typeName: hullType?.name ?? `Unknown type (${fit.shipTypeId})`,
        raceName: hullType?.raceId == null ? null : races.get(hullType.raceId) ?? null,
        groupName: hullType?.groupId == null ? null : groups.get(hullType.groupId)?.name ?? null,
      }}
    />
  );
}
