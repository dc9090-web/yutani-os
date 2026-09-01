import { notFound } from "next/navigation";
import { readSession } from "../../../../lib/auth/session.js";
import { listCharacters } from "../../../../lib/db/characters.js";
import { parseId } from "../../../../lib/api/json.js";
import { assetSheet } from "../../../../lib/ships/sheet.js";
import { pickActive } from "../../../../lib/view/characters.js";
import { NoCharacter } from "../../../components/NoCharacter.js";
import { CouldNotCompute } from "../../CouldNotCompute.js";
import { FitSheet } from "../../FitSheet.js";

export default async function AssetFitPage({ params }: { params: Promise<{ itemId: string }> }) {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Ships" />;

  const itemId = parseId((await params).itemId);
  if (itemId === null) notFound();
  const result = await assetSheet(character.id, itemId);
  if (result.kind === "notFound") notFound();
  if (result.kind === "error") return <CouldNotCompute title={result.title} />;
  return <FitSheet view={result.view} />;
}
