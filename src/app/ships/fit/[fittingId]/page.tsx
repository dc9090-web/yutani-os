import { notFound } from "next/navigation";
import { readSession } from "../../../../lib/auth/session.js";
import { listCharacters } from "../../../../lib/db/characters.js";
import { parseId } from "../../../../lib/api/json.js";
import { fittingSheet } from "../../../../lib/ships/sheet.js";
import { pickActive } from "../../../../lib/view/characters.js";
import { NoCharacter } from "../../../components/NoCharacter.js";
import { CouldNotCompute } from "../../CouldNotCompute.js";
import { FitSheet } from "../../FitSheet.js";

export default async function SavedFitPage({ params }: { params: Promise<{ fittingId: string }> }) {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Ships" />;

  const fittingId = parseId((await params).fittingId);
  if (fittingId === null) notFound();
  const result = await fittingSheet(character.id, fittingId);
  if (result.kind === "notFound") notFound();
  if (result.kind === "error") return <CouldNotCompute title={result.title} />;
  return <FitSheet view={result.view} />;
}
