import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { listAssets } from "../../lib/db/character-assets.js";
import { getTypes } from "../../lib/sde/repo.js";
import { locationLabels } from "../../lib/names/index.js";
import { pickActive } from "../../lib/view/characters.js";
import { buildAssetTree, locationDisplayLabel, sumVolume, toViewNodes, type AssetViewLocation } from "../../lib/view/assets.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { AssetsBrowser } from "./AssetsBrowser.js";

export default async function AssetsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Assets" />;

  // One query for the character's assets (spec §7), one for every type on the page, one for the
  // location names.
  const rows = await listAssets(character.id);
  const tree = buildAssetTree(rows);
  const [types, places] = await Promise.all([
    getTypes([...new Set(rows.map((r) => r.typeId))]),
    // Every root, including "item"-typed ones: those are orphans (a structure-docked hangar), so
    // they are places too — see locationDisplayLabel and AssetLocation's doc comment.
    locationLabels(tree.map((l) => l.locationId)),
  ]);

  const locations: AssetViewLocation[] = tree.map((location) => {
    const nodes = toViewNodes(location.nodes, types);
    return {
      locationId: location.locationId,
      label: locationDisplayLabel(location.locationId, places.get(location.locationId)),
      itemCount: location.itemCount,
      volume: sumVolume(nodes),
      nodes,
    };
  });

  return (<>
    <h1 className="page-title">Assets</h1>
    <p className="page-sub">{character.name} · {rows.length} item{rows.length === 1 ? "" : "s"} in {locations.length} location{locations.length === 1 ? "" : "s"}</p>
    <div className="card"><AssetsBrowser locations={locations} /></div>
  </>);
}
