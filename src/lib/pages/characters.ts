import { listAccounts } from "../db/accounts.js";
import { getSkillSummary } from "../db/character-skills.js";
import { listCharacters, type Character } from "../db/characters.js";
import { characterOptions, type CharacterOptionView } from "../view/characters.js";

/**
 * The character switcher's rows: every character with its account tag and total SP. A page that has
 * already read the character list (to pick the active one) hands it in.
 */
export async function loadCharacters(characters?: readonly Character[]): Promise<CharacterOptionView[]> {
  const list = characters ?? await listCharacters();
  const [accounts, summaries] = await Promise.all([
    listAccounts(),
    Promise.all(list.map((c) => getSkillSummary(c.id))),
  ]);
  const totalSp = new Map(list.map((c, index) => [c.id, summaries[index]?.totalSp ?? null]));
  return characterOptions(list, accounts, totalSp);
}
