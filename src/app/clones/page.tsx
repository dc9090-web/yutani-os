import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getClones, listImplants } from "../../lib/db/character-clones.js";
import { getTypeAttributes, getTypes } from "../../lib/sde/repo.js";
import { locationLabels } from "../../lib/names/index.js";
import { pickActive } from "../../lib/view/characters.js";
import { implantBonusLabel } from "../../lib/view/skills.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { ClonesCard, type ImplantView, type JumpCloneView } from "../skills/ClonesCard.js";

export default async function ClonesPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Clones" />;

  const [implantIds, clones] = await Promise.all([
    listImplants(character.id),
    getClones(character.id),
  ]);

  // One types query for the active implants and every jump clone's implants, one dogma query per
  // active implant (at most ten) and one locationLabels pass for the home station plus every jump clone.
  const jumpImplantIds = (clones?.jumpClones ?? []).flatMap((c) => c.implants);
  const [types, implantAttributes, places] = await Promise.all([
    getTypes([...new Set([...implantIds, ...jumpImplantIds])]),
    Promise.all(implantIds.map((id) => getTypeAttributes(id))),
    locationLabels([
      ...(clones?.homeLocationId == null ? [] : [clones.homeLocationId]),
      ...(clones?.jumpClones ?? []).map((c) => c.locationId).filter((id): id is number => id !== null),
    ]),
  ]);

  const implants: ImplantView[] = implantIds.map((typeId, index) => ({
    typeId,
    name: types.get(typeId)?.name ?? `Type ${typeId}`,
    bonus: implantBonusLabel(implantAttributes[index]),
  }));

  const jumpClones: JumpCloneView[] = (clones?.jumpClones ?? []).map((clone) => ({
    jumpCloneId: clone.jumpCloneId,
    label: clone.locationId === null ? "Unknown location" : places.get(clone.locationId)?.name ?? "Unknown location",
    name: clone.name,
    implants: clone.implants.map((typeId) => types.get(typeId)?.name ?? `Type ${typeId}`),
  }));

  return (<>
    <h1 className="page-title">Clones</h1>
    <p className="page-sub">{character.name}</p>
    <div className="card-stack">
      <ClonesCard
        home={clones?.homeLocationId == null ? null : places.get(clones.homeLocationId)?.name ?? null}
        implants={implants}
        jumpClones={jumpClones}
      />
    </div>
  </>);
}
