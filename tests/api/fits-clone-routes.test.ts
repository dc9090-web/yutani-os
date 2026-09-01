import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { fixtureData } from "../dogma/fixture.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";

const { loadFitData, loadDogmaData, getTypesByNames, getCharacter, createFit } = vi.hoisted(() => ({
  loadFitData: vi.fn(), loadDogmaData: vi.fn(), getTypesByNames: vi.fn(),
  getCharacter: vi.fn(), createFit: vi.fn(),
}));
vi.mock("../../src/lib/ships/load.js", () => ({ loadFitData }));
vi.mock("../../src/lib/dogma/sde-loader.js", () => ({ loadDogmaData }));
vi.mock("../../src/lib/sde/repo.js", () => ({ getTypesByNames }));
vi.mock("../../src/lib/db/characters.js", () => ({ getCharacter }));
vi.mock("../../src/lib/db/fits.js", () => ({ createFit }));

const { POST: IMPORT } = await import("../../src/app/api/fits/import/route.js");
const { POST: FROM_FITTING } = await import("../../src/app/api/fits/from-fitting/route.js");
const { POST: FROM_ASSET } = await import("../../src/app/api/fits/from-asset/route.js");

const data = fixtureData("rifter");
const CID = 669539978;
const ctx = { data, skills: new Map([[3426, 5]]), implants: [] };

const SHIP: AssetRow = {
  itemId: 1000, typeId: 587, quantity: 1, locationId: 60003760, locationType: "station",
  locationFlag: "Hangar", isSingleton: true, isBlueprintCopy: false, name: "Scarlet Dart",
};
const CHILDREN: AssetRow[] = [
  { ...SHIP, itemId: 1001, typeId: 2889, locationId: 1000, locationFlag: "HiSlot0", name: null },
  { ...SHIP, itemId: 1002, typeId: 12608, quantity: 400, locationId: 1000, locationFlag: "HiSlot0", isSingleton: false, name: null },
];
const FITTING = {
  fittingId: 55, name: "Saved Rifter", description: "from ESI", shipTypeId: 587,
  items: [{ idx: 0, typeId: 2048, quantity: 1, flag: "LoSlot0" }],
};

const byName = new Map<string, number>();
for (const type of data.types.values()) if (type.name !== null) byName.set(type.name.toLowerCase(), type.id);

const post = (path: string, body: unknown) =>
  new NextRequest(`https://eve.plasma66.com/api/fits/${path}`, {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.resetAllMocks();
  getCharacter.mockImplementation(async (id: number) => (id === CID ? { id: CID, name: "TrilliumONE" } : null));
  loadFitData.mockResolvedValue({ assets: [SHIP, ...CHILDREN], fittings: [FITTING], ctx, skillsSynced: true });
  loadDogmaData.mockResolvedValue(data);
  getTypesByNames.mockImplementation(async (names: string[]) =>
    new Map(names.map((n) => [n.toLowerCase(), byName.get(n.toLowerCase())])
      .filter((pair): pair is [string, number] => pair[1] !== undefined)));
  createFit.mockImplementation(async (input: { name: string; items: unknown[] }) => ({
    id: 1, description: "", characterId: null, shipTypeId: 587,
    createdAt: new Date(), updatedAt: new Date(), ...input,
  }));
});

describe("POST /api/fits/import", () => {
  const TEXT = "[Rifter, Imported]\nDamage Control II/offline\n200mm AutoCannon II, Hail S\nHobgoblin II x2\n";

  it("parses the text, creates an All-V fit and reports nothing unresolved", async () => {
    const res = await IMPORT(post("import", { text: TEXT }));
    expect(res.status).toBe(201);
    expect(createFit).toHaveBeenCalledWith({
      name: "Imported", shipTypeId: 587, characterId: null,
      items: [
        { typeId: 2048, quantity: 1, flag: "LoSlot0", chargeTypeId: null, state: "offline" },
        { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" },
        { typeId: 2456, quantity: 2, flag: "DroneBay", chargeTypeId: null, state: "active" },
      ],
    });
    await expect(res.json()).resolves.toMatchObject({ unresolved: [] });
  });

  it("reports names it could not resolve without failing", async () => {
    const res = await IMPORT(post("import", { text: "[Rifter, Typos]\nDamage Controll II\n" }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ unresolved: ["Damage Controll II"] });
  });

  it("400s on an unparseable text, a missing hull, an empty body and a huge body", async () => {
    expect((await IMPORT(post("import", { text: "just some words\n" }))).status).toBe(400);
    expect((await IMPORT(post("import", { text: "[Nonexistent Hull, x]\n" }))).status).toBe(400);
    expect((await IMPORT(post("import", { text: "" }))).status).toBe(400);
    expect((await IMPORT(post("import", { text: "x".repeat(100_001) }))).status).toBe(400);
    expect((await IMPORT(post("import", {}))).status).toBe(400);
    expect(createFit).not.toHaveBeenCalled();
  });
});

describe("POST /api/fits/from-fitting", () => {
  it("clones the saved fitting, keeping its name, description and character", async () => {
    const res = await FROM_FITTING(post("from-fitting", { characterId: CID, fittingId: 55 }));
    expect(res.status).toBe(201);
    expect(createFit).toHaveBeenCalledWith({
      name: "Saved Rifter", description: "from ESI", shipTypeId: 587, characterId: CID,
      items: [{ typeId: 2048, quantity: 1, flag: "LoSlot0", chargeTypeId: null, state: "online" }],
    });
  });

  it("404s on an unknown character or fitting, 400s on a bad body", async () => {
    expect((await FROM_FITTING(post("from-fitting", { characterId: 12345, fittingId: 55 }))).status).toBe(404);
    expect((await FROM_FITTING(post("from-fitting", { characterId: CID, fittingId: 99 }))).status).toBe(404);
    expect((await FROM_FITTING(post("from-fitting", { characterId: CID }))).status).toBe(400);
  });
});

describe("POST /api/fits/from-asset", () => {
  it("clones the assembled ship, keeping its custom name and its loaded charge", async () => {
    const res = await FROM_ASSET(post("from-asset", { characterId: CID, itemId: 1000 }));
    expect(res.status).toBe(201);
    expect(createFit).toHaveBeenCalledWith({
      name: "Scarlet Dart", description: "", shipTypeId: 587, characterId: CID,
      items: [{ typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" }],
    });
  });

  it("404s when that item is not an assembled ship of this character", async () => {
    expect((await FROM_ASSET(post("from-asset", { characterId: CID, itemId: 4242 }))).status).toBe(404);
  });

  it("404s when this SDE build no longer knows the hull, so it is not an assembled ship", async () => {
    loadFitData.mockResolvedValue({
      assets: [SHIP, ...CHILDREN], fittings: [],
      // `assembledShips` needs the hull's category from DogmaData; without it there is no ship.
      ctx: { data: { ...data, types: new Map() }, skills: new Map(), implants: [] }, skillsSynced: true,
    });
    expect((await FROM_ASSET(post("from-asset", { characterId: CID, itemId: 1000 }))).status).toBe(404);
  });
});
