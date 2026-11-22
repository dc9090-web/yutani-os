import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { loadAssets } from "../../lib/pages/assets.js";
import { pickActive } from "../../lib/view/characters.js";
import { grouped } from "../../lib/view/format.js";
import { CharacterPicker } from "../components/CharacterPicker.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { Place } from "../components/Place.js";
import { StatStrip } from "../components/StatStrip.js";
import { AssetsBrowser } from "./AssetsBrowser.js";

export default async function AssetsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Assets" />;

  const { itemCount, locations, descriptions } = await loadAssets(character.id);
  // `buildAssetTree` already sorts most items first.
  const largest = locations[0] ?? null;

  return (
    <div className="as-page">
      <div className="yo-page-head as-head">
        <h1 className="page-title">Assets</h1>
        <CharacterPicker characters={characters} activeId={character.id} />
      </div>
      <StatStrip label="Asset totals" min={220} small cells={[
        { label: "Items", value: grouped(itemCount) },
        { label: "Locations", value: grouped(locations.length) },
        largest === null
          ? { label: "Largest location", value: "—" }
          : { label: "Largest location", value: <Place name={largest.label} system={largest.system} />, unit: `${grouped(largest.itemCount)} item${largest.itemCount === 1 ? "" : "s"}`, valueIsText: true },
      ]} />
      <AssetsBrowser locations={locations} descriptions={descriptions} />
    </div>
  );
}
