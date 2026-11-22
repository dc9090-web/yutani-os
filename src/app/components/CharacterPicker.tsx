import type { Character } from "../../lib/db/characters.js";
import { loadCharacters } from "../../lib/pages/characters.js";
import { CharacterSelect } from "./CharacterSelect.js";

/**
 * Server half of the character dropdown: every character with its account tag and total SP. The
 * page has already read the character list (it needs it to pick the active one), so it is handed in.
 */
export async function CharacterPicker({ characters, activeId }: { characters: Character[]; activeId: number }) {
  return <CharacterSelect options={await loadCharacters(characters)} activeId={activeId} />;
}
