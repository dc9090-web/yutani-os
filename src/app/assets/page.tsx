import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { listAssets } from "../../lib/db/character-assets.js";
import { getGroups, getTypes } from "../../lib/sde/repo.js";
import { locationLabels } from "../../lib/names/index.js";
import { pickActive } from "../../lib/view/characters.js";
import { grouped, typeDescription } from "../../lib/view/format.js";
import { buildAssetTree, isBlueprintCategory, isChargeCategory, locationDisplayLabel, sumVolume, toViewNodes, type AssetViewLocation, type TypeInfo } from "../../lib/view/assets.js";
import { CharacterPicker } from "../components/CharacterPicker.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { StatStrip } from "../components/StatStrip.js";
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

  // Blueprints have no "icon" image, only bp/bpc, and a loaded charge shares its module's slot —
  // both facts live on the group's category, so one more small batch over the groups on the page.
  const groups = await getGroups([...new Set([...types.values()].flatMap((t) => (t.groupId === null ? [] : [t.groupId])))]);
  const typeInfo = new Map<number, TypeInfo>();
  for (const [id, type] of types) {
    const categoryId = type.groupId === null ? null : groups.get(type.groupId)?.categoryId ?? null;
    typeInfo.set(id, { name: type.name, volume: type.volume, isBlueprint: isBlueprintCategory(categoryId), isCharge: isChargeCategory(categoryId) });
  }

  // Hover text, once per type rather than per item: a hangar of 800 rows is ~200 types.
  const descriptions: Record<number, string> = {};
  for (const [id, type] of types) {
    const desc = typeDescription(type.description);
    if (desc !== null) descriptions[id] = desc;
  }

  const locations: AssetViewLocation[] = tree.map((location) => {
    const nodes = toViewNodes(location.nodes, typeInfo);
    return {
      locationId: location.locationId,
      label: locationDisplayLabel(location.locationId, places.get(location.locationId)),
      itemCount: location.itemCount,
      volume: sumVolume(nodes),
      nodes,
    };
  });
  // `buildAssetTree` already sorts most items first.
  const largest = locations[0] ?? null;

  return (
    <div className="as-page">
      <div className="yo-page-head as-head">
        <h1 className="page-title">Assets</h1>
        <CharacterPicker characters={characters} activeId={character.id} />
      </div>
      <StatStrip label="Asset totals" min={220} small cells={[
        { label: "Items", value: grouped(rows.length) },
        { label: "Locations", value: grouped(locations.length) },
        largest === null
          ? { label: "Largest location", value: "—" }
          : { label: "Largest location", value: largest.label, unit: `${grouped(largest.itemCount)} item${largest.itemCount === 1 ? "" : "s"}`, valueIsText: true },
      ]} />
      <AssetsBrowser locations={locations} descriptions={descriptions} />
    </div>
  );
}
