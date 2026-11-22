import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getClones, listImplants } from "../../lib/db/character-clones.js";
import { getTypeAttributes, getTypes } from "../../lib/sde/repo.js";
import { placeViews } from "../../lib/names/place.js";
import { pickActive } from "../../lib/view/characters.js";
import { cloneLocations, cloneView, type ClonePlace, type ImplantSource } from "../../lib/view/clones.js";
import { typeDescription } from "../../lib/view/format.js";
import { CharacterPicker } from "../components/CharacterPicker.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { PageHead } from "../components/PageHead.js";
import { ClonesView } from "./ClonesView.js";

export default async function ClonesPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Clones" />;

  const [implantIds, clones] = await Promise.all([
    listImplants(character.id),
    getClones(character.id),
  ]);
  const jumpClones = clones?.jumpClones ?? [];

  // One types query for every implant on the page, one dogma query per distinct implant type (the
  // slot and the attribute bonus both live there), and one locationLabels pass for the home station
  // plus every jump clone.
  const typeIds = [...new Set([...implantIds, ...jumpClones.flatMap((c) => c.implants)])];
  const [types, attributes, places] = await Promise.all([
    getTypes(typeIds),
    Promise.all(typeIds.map((id) => getTypeAttributes(id))),
    placeViews([
      ...(clones?.homeLocationId == null ? [] : [clones.homeLocationId]),
      ...jumpClones.map((c) => c.locationId).filter((id): id is number => id !== null),
    ]),
  ]);

  const implantTypes = new Map<number, ImplantSource>(typeIds.map((id, index) => [id, {
    name: types.get(id)?.name ?? null,
    attributes: attributes[index],
    desc: typeDescription(types.get(id)?.description),
  }]));
  const clonePlaces = new Map<number, ClonePlace>([...places].map(([id, place]) => [id, {
    name: place.name,
    // A clone parked in a system-level place has nothing more specific than the system itself.
    systemName: place.kind === "system" ? null : place.system?.name ?? null,
    system: place.system,
  }]));

  return (<>
    <PageHead title="Clones">
      <CharacterPicker characters={characters} activeId={character.id} />
    </PageHead>
    <ClonesView
      synced={clones !== null || implantIds.length > 0}
      home={clones?.homeLocationId == null ? null : places.get(clones.homeLocationId) ?? null}
      active={cloneView(implantIds, implantTypes)}
      locations={cloneLocations(jumpClones, clonePlaces, implantTypes)}
    />
  </>);
}
