import { listAccounts } from "../db/accounts.js";
import { listCharacters } from "../db/characters.js";
import { getWallet } from "../db/character-wallet.js";
import { getLocation } from "../db/character-location.js";
import { getSkillSummary, listSkillQueue } from "../db/character-skills.js";
import { getGroups, getRaces, getSolarSystems, getTypes } from "../sde/repo.js";
import { locationLabels } from "../names/index.js";
import { tagsByCharacter } from "../db/tags.js";
import { grouped, overviewTraining, secClass, secText, sp } from "../view/format.js";
import { liveQueue } from "../view/skills.js";
import { getConfig } from "../config.js";
import { accountTag, overviewCharacters } from "../view/characters.js";
import { overviewSummary, type OverviewSummary } from "../view/overview.js";
import type { OverviewCard } from "../../app/components/CharacterCard.js";
import { rawQueue } from "./raw.js";

export interface OverviewData {
  /**
   * `queuesActive` and `next` are worked out against the clock. Their raw values are the cards'
   * `trainingRaw` queues: a queue is active when its live head finishes in the future, and `next` is
   * the soonest of those heads with its card's name.
   */
  summary: OverviewSummary;
  cards: OverviewCard[];
}

/** The Overview: one card per chosen character and the summary strip folded over the same rows. */
export async function loadOverview(now: Date): Promise<OverviewData> {
  const [allCharacters, accounts, tagsByChar] = await Promise.all([listCharacters(), listAccounts(), tagsByCharacter()]);
  const characters = overviewCharacters(allCharacters, getConfig().overviewCharacterIds);

  // Four repo reads per character, all in flight at once; the id -> name lookups below are then
  // batched across every character so the page never queries inside a row loop.
  const rows = await Promise.all(characters.map(async (character) => {
    const [wallet, location, summary, queue] = await Promise.all([
      getWallet(character.id),
      getLocation(character.id),
      getSkillSummary(character.id),
      listSkillQueue(character.id),
    ]);
    return { character, wallet, location, summary, queue, head: liveQueue(queue, now)[0] ?? null };
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
    // Every queued skill, not only the head: the raw queue names them all.
    for (const entry of row.queue) typeIds.add(entry.skillId);
  }
  const [types, systems, places, races] = await Promise.all([
    getTypes([...typeIds]),
    getSolarSystems([...systemIds]),
    locationLabels([...placeIds]),
    getRaces(),
  ]);
  const skillNames = new Map([...types].flatMap(([id, type]) => (type.name === null ? [] : [[id, type.name] as const])));

  // The ship's group (its category pill, e.g. "Frigate") lives on sde_groups, keyed by the hull
  // type's group id — not knowable until `types` comes back, so this is a third, smaller wave.
  const groupIds = new Set<number>();
  for (const row of rows) {
    const groupId = row.location?.shipTypeId == null ? null : types.get(row.location.shipTypeId)?.groupId ?? null;
    if (groupId !== null && groupId !== undefined) groupIds.add(groupId);
  }
  const groups = await getGroups([...groupIds]);

  const cards: OverviewCard[] = rows.map(({ character, wallet, location, summary, queue, head }) => {
    const system = location?.solarSystemId == null ? null : systems.get(location.solarSystemId) ?? null;
    const docked = location?.stationId ?? location?.structureId ?? null;
    const shipType = location?.shipTypeId == null ? null : types.get(location.shipTypeId) ?? null;
    const headName = head === null ? null : types.get(head.skillId)?.name ?? `Skill ${head.skillId}`;
    return {
      id: character.id,
      name: character.name,
      corp: `${character.corporationName ?? "—"}${character.allianceName ? ` · ${character.allianceName}` : ""}`,
      race: character.raceId === null ? null : races.get(character.raceId) ?? null,
      needsReauth: character.tokenStatus === "needs_reauth",
      balance: wallet === null ? null : grouped(Math.round(wallet.balance)),
      system: location?.solarSystemId == null ? null : {
        name: system?.name ?? `Unknown system (${location.solarSystemId})`,
        sec: secText(system?.securityStatus ?? null),
        secClass: secClass(system?.securityStatus ?? null),
      },
      dockedAt: docked === null ? null : places.get(docked)?.name ?? null,
      ship: shipType?.name == null ? null : {
        typeId: shipType.id,
        typeName: shipType.name,
        groupName: shipType.groupId == null ? null : groups.get(shipType.groupId)?.name ?? null,
      },
      online: location?.online ?? null,
      // "Not synced" means the skills job has never written a summary; an empty queue is different.
      training: summary === null ? { active: false, label: "Not synced" }
        : overviewTraining(head === null || headName === null ? null
          : { ...head, skillName: headName }, now),
      trainingRaw: { synced: summary !== null, queue: rawQueue(queue, skillNames) },
      totalSp: summary === null ? null : sp(summary.totalSp, false),
      accountTag: accountTag(character.accountId, accounts),
      tags: tagsByChar.get(character.id) ?? [],
    };
  });

  const summary = overviewSummary(rows.map(({ character, wallet, summary: skills, head }) => ({
    name: character.name,
    balance: wallet?.balance ?? null,
    totalSp: skills?.totalSp ?? null,
    headFinish: head?.finishDate ?? null,
  })), now);

  return { summary, cards };
}
