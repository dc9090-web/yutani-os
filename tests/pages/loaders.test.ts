import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { closePool } from "../../src/lib/db/client.js";
import { listCharacters } from "../../src/lib/db/characters.js";
import { loadAssets } from "../../src/lib/pages/assets.js";
import { loadCharacters } from "../../src/lib/pages/characters.js";
import { loadClones } from "../../src/lib/pages/clones.js";
import { loadOverview } from "../../src/lib/pages/overview.js";
import { loadAssetSheet, loadFittingSheet, loadShips } from "../../src/lib/pages/ships.js";
import { loadSkills, loadTraining, loadTrainingOverview } from "../../src/lib/pages/skills.js";
import { loadWallet, loadWalletRows, loadWalletSummary } from "../../src/lib/pages/wallet.js";
import { launchedTotals } from "../../src/lib/view/drones.js";
import { duration, queueProgress } from "../../src/lib/view/format.js";
import { ALT, FIXTURE_NOW, FRESH, MAIN, RIFTER_FIT, RIFTER_ITEM, TRISTAN_FIT, TRISTAN_ITEM, seedApiFixtureDb } from "../api/v1/fixture-data.js";

// Every loader against the invented account of tests/api/v1/fixture-data.ts, at FIXTURE_NOW
// (2026-03-14 12:00 UTC): the main is 5 h 30 m into Drone Interfacing V with one finished entry
// still stored at the front of its queue.
beforeAll(async () => { await seedApiFixtureDb(); }, 180_000);
afterAll(closePool);

const NEXT_WEEK = new Date("2026-03-21T12:00:00.000Z");
const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe("loadCharacters", () => {
  it("lists every character in the site's order with its account tag and SP", async () => {
    expect(await loadCharacters()).toEqual([
      { id: MAIN, name: "Example Pilot One", tag: "MAIN", sp: "3.9M", needsReauth: false },
      { id: ALT, name: "Example Pilot Two", tag: "ALT", sp: "1.3M", needsReauth: true },
      { id: FRESH, name: "Example Pilot Three", tag: null, sp: null, needsReauth: false },
    ]);
  });
  it("gives the same rows for a list the page already read", async () => {
    expect(await loadCharacters(await listCharacters())).toEqual(await loadCharacters());
  });
});

describe("loadOverview", () => {
  it("builds one card per character and the summary strip", async () => {
    const { cards, summary } = await loadOverview(FIXTURE_NOW);
    expect(cards.map((c) => c.id)).toEqual([MAIN, ALT, FRESH]);
    expect(summary).toEqual({ wallet: "1.28B", totalSp: "5.1M", queuesActive: 1, queuesTotal: 3, next: { time: "5d 6h 45m", name: "Example Pilot One" } });
    expect(cards[0]).toMatchObject({
      name: "Example Pilot One", corp: "Example Corporation · Example Alliance", race: "Gallente", balance: "1,284,503,217",
      system: { name: "Jita", sec: "0.9", secClass: "sec-high" }, dockedAt: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
      ship: { typeId: 593, typeName: "Tristan", groupName: "Frigate" }, online: false, accountTag: "MAIN", tags: ["Scout"],
      training: { active: true, skill: "Drone Interfacing V", time: "5d 6h 45m", percent: 11 },
    });
    expect(cards[1].training).toEqual({ active: true, skill: "Minmatar Frigate IV", time: "paused", percent: 0 });
    expect(cards[2]).toMatchObject({ balance: null, system: null, ship: null, online: null, totalSp: null, training: { active: false, label: "Not synced" } });
  });

  it("carries the stored queue beside the clock strings, finished entries included", async () => {
    const { cards } = await loadOverview(FIXTURE_NOW);
    const raw = cards[0].trainingRaw!;
    expect(raw.synced).toBe(true);
    expect(raw.queue.map((q) => q.label)).toEqual(["Surgical Strike IV", "Drone Interfacing V", "Gallente Drone Specialization IV", "Gallente Drone Specialization V"]);
    expect(raw.queue[1]).toEqual({
      skillId: 3442, skill: "Drone Interfacing", level: 5, label: "Drone Interfacing V",
      startAt: "2026-03-14T06:30:00.000Z", finishAt: "2026-03-19T18:45:00.000Z", levelStartSp: 45255, levelEndSp: 256000, trainingStartSp: 61200,
    });
    expect(cards[1].trainingRaw!.queue[0]).toMatchObject({ startAt: null, finishAt: null });
    expect(cards[2].trainingRaw).toEqual({ synced: false, queue: [] });
  });

  it("the raw values are enough to work the clock strings out again", async () => {
    const { cards } = await loadOverview(FIXTURE_NOW);
    const head = cards[0].trainingRaw!.queue.find((q) => q.finishAt === null || Date.parse(q.finishAt) > FIXTURE_NOW.getTime())!;
    const entry = { ...head, startDate: new Date(head.startAt!), finishDate: new Date(head.finishAt!) };
    expect(cards[0].training).toEqual({
      active: true, skill: head.label,
      time: duration(entry.finishDate.getTime() - FIXTURE_NOW.getTime()),
      percent: Math.round(queueProgress(entry, FIXTURE_NOW) * 100),
    });
  });

  it("moves the clock strings with the clock and leaves the raw values alone", async () => {
    const now = await loadOverview(FIXTURE_NOW);
    const later = await loadOverview(NEXT_WEEK);
    expect(later.cards[0].training).toMatchObject({ skill: "Gallente Drone Specialization IV" });
    expect(later.cards.map((c) => c.trainingRaw)).toEqual(now.cards.map((c) => c.trainingRaw));
  });
});

describe("loadSkills", () => {
  it("groups the sheet and lays the live queue over it", async () => {
    const data = await loadSkills(MAIN, FIXTURE_NOW);
    expect(data.queueLength).toBe(3);
    const skills = data.groups.flatMap((g) => g.skills);
    expect(skills.find((s) => s.skillId === 3442)).toMatchObject({ name: "Drone Interfacing", level: 4, queued: 1, training: true, trainedLevel: 4, trainedActiveLevel: 4 });
    expect(skills.find((s) => s.skillId === 12486)).toMatchObject({ level: 3, queued: 2, training: false });
    expect(data.groups.find((g) => g.name === "Drones")).toMatchObject({ queued: 3 });
    expect(typeof data.groups[0].groupSp).toBe("string");
    expect(skills.every((s) => typeof s.desc === "string" || s.desc === null)).toBe(true);
  });

  it("keeps the stored levels and queue as raw values when the clock moves a level across", async () => {
    const later = await loadSkills(MAIN, NEXT_WEEK);
    const interfacing = later.groups.flatMap((g) => g.skills).find((s) => s.skillId === 3442)!;
    // Drone Interfacing V finished on the 19th: nothing is queued for it now, the stored sheet still says IV.
    expect(interfacing).toMatchObject({ level: 4, queued: 0, training: false, trainedLevel: 4 });
    const specialization = later.groups.flatMap((g) => g.skills).find((s) => s.skillId === 12486)!;
    expect(specialization).toMatchObject({ level: 3, queued: 2, training: true, trainedLevel: 3 });
    expect(later.queueLength).toBe(2);
    expect(later.queue).toEqual((await loadSkills(MAIN, FIXTURE_NOW)).queue);
    expect(later.queue).toHaveLength(4);
  });

  it("is empty, not an error, for a character with nothing synced", async () => {
    expect(await loadSkills(FRESH, FIXTURE_NOW)).toEqual({ groups: [], queueLength: 0, queue: [] });
  });
});

describe("loadTraining", () => {
  it("lists the live queue with the head in training", async () => {
    const data = await loadTraining(MAIN, FIXTURE_NOW);
    expect(data.finishAt).toBe("2026-04-05T21:00:00.000Z");
    expect(data.eta).toBe("22d 9h 0m 0s");
    expect(data.entries.map((e) => [e.position, e.skill, e.targetLevel, e.remaining])).toEqual([
      [1, "Drone Interfacing", 5, "5d 6h 45m"],
      [2, "Gallente Drone Specialization", 4, "2d 8h 25m"],
      [3, "Gallente Drone Specialization", 5, "14d 17h 50m"],
    ]);
    expect(data.entries[0].progress).toBeCloseTo(0.1141, 3);
    expect(data.entries[1].progress).toBeNull();
    expect(data.entries[0]).toMatchObject({ startAt: "2026-03-14T06:30:00.000Z", finishAt: "2026-03-19T18:45:00.000Z", levelStartSp: 45255, levelEndSp: 256000, trainingStartSp: 61200 });
  });

  it("a paused queue has no dates, no progress and nothing to count down to", async () => {
    const data = await loadTraining(ALT, FIXTURE_NOW);
    expect(data).toMatchObject({ finishAt: null, eta: "—" });
    expect(data.entries.map((e) => [e.remaining, e.progress, e.startAt, e.finishAt])).toEqual([["—", null, null, null], ["—", null, null, null]]);
  });

  it("an empty queue is an empty list", async () => {
    expect(await loadTraining(FRESH, FIXTURE_NOW)).toEqual({ entries: [], finishAt: null, eta: "—" });
  });
});

describe("loadTrainingOverview", () => {
  it("shows every character's queue with its raw entries", async () => {
    const data = await loadTrainingOverview(await listCharacters(), FIXTURE_NOW);
    expect(data.all).toEqual([{ id: MAIN, name: "Example Pilot One" }, { id: ALT, name: "Example Pilot Two" }, { id: FRESH, name: "Example Pilot Three" }]);
    expect(data.characters.map((c) => [c.id, c.status.kind, c.count, c.synced, c.queue.length])).toEqual([
      [MAIN, "eta", 3, true, 4], [ALT, "paused", 2, true, 2], [FRESH, "notSynced", 0, false, 0],
    ]);
    expect(data.characters[0].status).toEqual({ kind: "eta", text: "22d 9h" });
    expect(data.characters[0].rows[0]).toEqual({ position: 1, skill: "Drone Interfacing", trainedLevel: 4, targetLevel: 5, training: true, remaining: "5d 6h 45m" });
    expect(data.characters[0].progress).toBeCloseTo(0.1141, 3);
  });
});

describe("loadClones", () => {
  it("shows the active clone, the home station and jump clones by place", async () => {
    const data = await loadClones(MAIN);
    expect(data.synced).toBe(true);
    expect(data.home).toEqual({ name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", kind: "station", system: { name: "Jita", sec: "0.9", secClass: "sec-high" } });
    expect(data.active.used).toBe(6);
    expect(data.active.implants[0]).toMatchObject({ name: "Ocular Filter - Standard", slot: 1, bonus: "+4 Perception" });
    expect(data.locations.map((l) => [l.title, l.station, l.clones.map((c) => c.code)])).toEqual([
      ["Perimeter", "Perimeter - Example Trade Tower", ["JC 02", "JC 03"]],
      ["Jita", "Jita IV - Moon 4 - Caldari Navy Assembly Plant", ["JC 01"]],
    ]);
    expect(data.lastCloneJumpAt).toBe("2026-03-13T17:20:00.000Z");
  });
  it("says not synced for a character the clones job has not reached", async () => {
    expect(await loadClones(FRESH)).toMatchObject({ synced: false, home: null, locations: [], lastCloneJumpAt: null });
  });
});

describe("loadAssets", () => {
  it("returns the tree by location, largest first, with hover text per type", async () => {
    const data = await loadAssets(MAIN);
    expect(data.itemCount).toBe(29);
    expect(data.locations.map((l) => [l.label, l.itemCount, l.system?.name])).toEqual([
      ["Jita IV - Moon 4 - Caldari Navy Assembly Plant", 24, "Jita"], ["Perimeter - Example Trade Tower", 5, "Perimeter"],
    ]);
    const tristan = data.locations[0].nodes.find((n) => n.itemId === TRISTAN_ITEM)!;
    expect(tristan).toMatchObject({ typeName: "Tristan", name: "Paper Kite" });
    expect(tristan.children).toHaveLength(18);
    expect(data.descriptions[593]).toEqual(expect.any(String));
    expect(json(data)).toEqual(data);                       // plain JSON all the way down
  });
  it("is empty for a character with no assets", async () => {
    expect(await loadAssets(ALT)).toEqual({ itemCount: 0, locations: [], descriptions: {} });
  });
});

describe("the wallet loaders", () => {
  it("loadWalletSummary formats the balance and keeps the number", async () => {
    expect(await loadWalletSummary(MAIN)).toEqual({ balance: "1,284,503,217.44", balanceIsk: 1284503217.44 });
    expect(await loadWalletSummary(ALT)).toEqual({ balance: null, balanceIsk: null });
  });

  it("loadWalletRows slices either list, newest first", async () => {
    const journal = await loadWalletRows(MAIN, "journal", 0, 500);
    expect(journal).toMatchObject({ kind: "journal", offset: 0, limit: 500 });
    expect(journal.rows.map((r) => (r as { id: number }).id)).toEqual([5002, 5001, 5003, 5004, 5005, 5006, 5007, 5008]);
    expect(journal.rows[3]).toMatchObject({ withParty: "Own escrow", signedAmount: "−25,000,000.00" });
    const page = await loadWalletRows(MAIN, "journal", 2, 3);
    expect(page.rows.map((r) => (r as { id: number }).id)).toEqual([5003, 5004, 5005]);
    const transactions = await loadWalletRows(MAIN, "transactions", 0, 2);
    expect(transactions.rows).toHaveLength(2);
    expect(transactions.rows[0]).toMatchObject({ transactionId: 6001, side: "Sell", typeName: "Hobgoblin II", location: "Jita IV - Moon 4 - Caldari Navy Assembly Plant" });
  });

  it("loadWallet is the page: the summary and the first page of each list", async () => {
    const data = await loadWallet(MAIN);
    expect(data.summary).toEqual(await loadWalletSummary(MAIN));
    expect(data.journal).toEqual((await loadWalletRows(MAIN, "journal", 0, 100)).rows);
    expect(data.transactions).toEqual((await loadWalletRows(MAIN, "transactions", 0, 100)).rows);
  });
});

describe("loadShips", () => {
  it("lists fitted ships and saved fits as cards", async () => {
    const data = await loadShips(MAIN);
    expect(data.skillsSynced).toBe(true);
    expect(data.ships.map((c) => [c.key, c.name, c.typeName, c.location])).toEqual([
      [`asset:${TRISTAN_ITEM}`, "Paper Kite", "Tristan", "Jita IV - Moon 4 - Caldari Navy Assembly Plant"],
      [`asset:${RIFTER_ITEM}`, "Scarlet Dart", "Rifter", "Perimeter - Example Trade Tower"],
    ]);
    expect(data.fits.map((c) => c.key).sort()).toEqual([`fit:${TRISTAN_FIT}`, `fit:${RIFTER_FIT}`]);
    expect(data.ships[0]).toMatchObject({ error: null, raceName: "Gallente", groupName: "Frigate", system: { name: "Jita" } });
    expect(data.ships[0].stats).not.toBeNull();
  });
  it("has nothing, and says skills are not synced, for a new character", async () => {
    expect(await loadShips(FRESH)).toEqual({ skillsSynced: false, ships: [], fits: [] });
  });
});

describe("the ship detail loaders", () => {
  it("loadAssetSheet carries the drone limits the selector sums over", async () => {
    const result = await loadAssetSheet(MAIN, TRISTAN_ITEM);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const { droneControl, weapons } = result.view;
    expect(droneControl).toMatchObject({ bandwidth: 25, maxActive: 5, launched: { 2456: 5 } });
    expect(droneControl!.types.map((t) => [t.name, t.inBay, t.bandwidth])).toEqual([["Hobgoblin II", 5, 5], ["Warrior II", 3, 5]]);
    expect(droneControl!.types.every((t) => t.dpsEach > 0 && t.volleyEach > 0)).toBe(true);
    expect(weapons.dps).toBeGreaterThan(0);
    // The site's own sum, on the numbers as a client receives them.
    const sent = json(droneControl) as NonNullable<typeof droneControl>;
    expect(launchedTotals(sent, { 2456: 3, 2488: 2 })).toMatchObject({ active: 5, bandwidthUsed: 25 });
    expect(launchedTotals(sent, sent.launched).dps).toBeCloseTo(5 * sent.types[0].dpsEach, 6);
  });

  it("loadFittingSheet renders a saved fit", async () => {
    const result = await loadFittingSheet(MAIN, TRISTAN_FIT);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.view).toMatchObject({ title: "Tristan - drone brawler", typeName: "Tristan", location: { system: null, place: null, note: "Saved fit" } });
    expect(result.view.droneControl).not.toBeNull();
  });

  it("answers notFound for a ship or fit that is not this character's", async () => {
    expect(await loadAssetSheet(ALT, TRISTAN_ITEM)).toEqual({ kind: "notFound" });
    expect(await loadAssetSheet(MAIN, 424242)).toEqual({ kind: "notFound" });
    expect(await loadFittingSheet(MAIN, 424242)).toEqual({ kind: "notFound" });
    expect(await loadFittingSheet(ALT, RIFTER_FIT)).toEqual({ kind: "notFound" });
  });
});
