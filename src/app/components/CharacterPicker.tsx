import { listAccounts } from "../../lib/db/accounts.js";
import { getSkillSummary } from "../../lib/db/character-skills.js";
import type { Character } from "../../lib/db/characters.js";
import { characterOptions } from "../../lib/view/characters.js";
import { CharacterSelect } from "./CharacterSelect.js";

/**
 * Server half of the character dropdown: every character with its account tag and total SP. The
 * page has already read the character list (it needs it to pick the active one), so it is handed in.
 */
export async function CharacterPicker({ characters, activeId }: { characters: Character[]; activeId: number }) {
  const [accounts, summaries] = await Promise.all([
    listAccounts(),
    Promise.all(characters.map((c) => getSkillSummary(c.id))),
  ]);
  const totalSp = new Map(characters.map((c, index) => [c.id, summaries[index]?.totalSp ?? null]));
  return <CharacterSelect options={characterOptions(characters, accounts, totalSp)} activeId={activeId} />;
}
