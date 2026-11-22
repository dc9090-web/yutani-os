import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { loadClones } from "../../lib/pages/clones.js";
import { pickActive } from "../../lib/view/characters.js";
import { CharacterPicker } from "../components/CharacterPicker.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { PageHead } from "../components/PageHead.js";
import { ClonesView } from "./ClonesView.js";

export default async function ClonesPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Clones" />;

  const clones = await loadClones(character.id);

  return (<>
    <PageHead title="Clones">
      <CharacterPicker characters={characters} activeId={character.id} />
    </PageHead>
    <ClonesView synced={clones.synced} home={clones.home} active={clones.active} locations={clones.locations} />
  </>);
}
