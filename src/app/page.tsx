import { listAccounts } from "../lib/db/accounts.js";
import { listCharacters } from "../lib/db/characters.js";
import { getWallet } from "../lib/db/character-wallet.js";
import { getLocation } from "../lib/db/character-location.js";
import { getSkillSummary, listSkillQueue } from "../lib/db/character-skills.js";
import { getGroups, getSolarSystems, getTypes } from "../lib/sde/repo.js";
import { locationLabels } from "../lib/names/index.js";
import { tagsByCharacter } from "../lib/db/tags.js";
import { iskWhole, overviewTraining, secClass, secText, sp } from "../lib/view/format.js";
import { CharacterCard, type OverviewCard } from "./components/CharacterCard.js";
import { NoCharacter } from "./components/NoCharacter.js";

export default async function Overview() {
  const [characters, accounts, tagsByChar] = await Promise.all([listCharacters(), listAccounts(), tagsByCharacter()]);
  if (characters.length === 0) return <NoCharacter title="Overview" />;
  const now = new Date();
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));

  // Four repo reads per character, all in flight at once; the id -> name lookups below are then
  // batched across every character so the page never queries inside a row loop.
  const rows = await Promise.all(characters.map(async (character) => {
    const [wallet, location, summary, queue] = await Promise.all([
      getWallet(character.id),
      getLocation(character.id),
      getSkillSummary(character.id),
      listSkillQueue(character.id),
    ]);
    return { character, wallet, location, summary, head: queue[0] ?? null };
  }));

  const typeIds = new Set<number>();
  const systemIds = new Set<number>();
  const placeIds = new Set<number>();
  for (const row of rows) {
    if (row.location?.shipTypeId != null) typeIds.add(row.location.shipTypeId);
    if (row.location?.solarSystemId != null) systemIds.add(row.location.solarSystemId);
    // Exactly one of station/structure is set when docked, neither when in space.
    const docked = row.location?.stationId ?? row.location?.structureId ?? null;
    if (docked !== null) placeIds.add(docked);
    if (row.head !== null) typeIds.add(row.head.skillId);
  }
  const [types, systems, places] = await Promise.all([
    getTypes([...typeIds]),
    getSolarSystems([...systemIds]),
    locationLabels([...placeIds]),
  ]);

  // The ship's group (its category pill, e.g. "Frigate") lives on sde_groups, keyed by the hull
  // type's group id — not knowable until `types` comes back, so this is a third, smaller wave.
  const groupIds = new Set<number>();
  for (const row of rows) {
    const groupId = row.location?.shipTypeId == null ? null : types.get(row.location.shipTypeId)?.groupId ?? null;
    if (groupId !== null && groupId !== undefined) groupIds.add(groupId);
  }
  const groups = await getGroups([...groupIds]);

  const cards: OverviewCard[] = rows.map(({ character, wallet, location, summary, head }) => {
    const system = location?.solarSystemId == null ? null : systems.get(location.solarSystemId) ?? null;
    const docked = location?.stationId ?? location?.structureId ?? null;
    const shipType = location?.shipTypeId == null ? null : types.get(location.shipTypeId) ?? null;
    const headName = head === null ? null : types.get(head.skillId)?.name ?? `Skill ${head.skillId}`;
    return {
      id: character.id,
      name: character.name,
      corp: `${character.corporationName ?? "—"}${character.allianceName ? ` · ${character.allianceName}` : ""}`,
      needsReauth: character.tokenStatus === "needs_reauth",
      balance: wallet === null ? null : iskWhole(wallet.balance),
      system: location?.solarSystemId == null ? null : {
        name: system?.name ?? `Unknown system (${location.solarSystemId})`,
        sec: secText(system?.securityStatus ?? null),
        secClass: secClass(system?.securityStatus ?? null),
      },
      dockedAt: docked === null ? null : places.get(docked)?.name ?? null,
      ship: shipType?.name == null ? null : {
        typeName: shipType.name,
        groupName: shipType.groupId == null ? null : groups.get(shipType.groupId)?.name ?? null,
      },
      online: location?.online ?? null,
      // "Not synced" means the skills job has never written a summary; an empty queue is different.
      training: summary === null ? { active: false, label: "Not synced" }
        : overviewTraining(head === null || headName === null ? null
          : { skillName: headName, finishedLevel: head.finishedLevel, startDate: head.startDate, finishDate: head.finishDate }, now),
      totalSp: summary === null ? null : sp(summary.totalSp, false),
      account: character.accountId == null ? null : accountNames.get(character.accountId) ?? null,
      tags: tagsByChar.get(character.id) ?? [],
    };
  });

  return (<>
    <h1 className="page-title">Overview</h1>
    <p className="page-sub">{cards.length} character{cards.length === 1 ? "" : "s"} authorised</p>
    <div className="card-grid overview">
      {cards.map((card) => <CharacterCard key={card.id} card={card} />)}
    </div>
  </>);
}
