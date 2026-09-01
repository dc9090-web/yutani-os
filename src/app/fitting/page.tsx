import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { loadFittingIndex } from "../../lib/fits/load.js";
import { pickActive } from "../../lib/view/characters.js";
import { FitList } from "./FitList.js";

export default async function FittingPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  const index = await loadFittingIndex(character?.id ?? null);

  return (<>
    <h1 className="page-title">Fitting</h1>
    <p className="page-sub">{character === null ? "No character" : character.name}</p>
    <FitList index={index} characterId={character?.id ?? null} />
  </>);
}
