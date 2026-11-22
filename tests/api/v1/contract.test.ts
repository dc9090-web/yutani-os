import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, readdir } from "node:fs/promises";
import { closePool } from "../../../src/lib/db/client.js";
import { buildApiFixtures, seedApiFixtureDb, type Envelope } from "./fixture-data.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "api-fixtures", "v1");

async function filesUnder(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...await filesUnder(path.join(dir, entry.name), `${prefix}${entry.name}/`));
    else if (entry.name.endsWith(".json")) out.push(`${prefix}${entry.name}`);
  }
  return out;
}

// api-fixtures/v1 is what the Android app's models are tested against. When a loader's output
// changes shape or value this fails: run `npm run api:fixtures`, read the diff, and change the app
// (and api-fixtures/v1/README.md) with it.
let built: Map<string, Envelope>;
beforeAll(async () => {
  await seedApiFixtureDb();
  built = await buildApiFixtures();
}, 180_000);
afterAll(closePool);

describe("api-fixtures/v1", () => {
  it("holds exactly one file per resource the sync list names, plus the list", async () => {
    expect((await filesUnder(DIR)).sort()).toEqual([...built.keys()].sort());
  });

  it("matches what the loaders produce today, file by file", async () => {
    for (const [file, envelope] of built) {
      const committed = JSON.parse(await readFile(path.join(DIR, file), "utf8")) as Envelope;
      expect(committed, `${file} — run \`npm run api:fixtures\` if this change is meant`).toEqual(envelope);
    }
  });

  it("covers the routes the app needs an example of", () => {
    const files = [...built.keys()];
    for (const wanted of ["sync.json", "me.json", "characters.json", "overview.json", "training-overview.json"]) expect(files).toContain(wanted);
    for (const tail of ["skills", "training", "clones", "assets", "wallet", "wallet-journal", "wallet-transactions", "ships"]) {
      expect(files).toContain(`characters/9000001/${tail}.json`);
    }
    const sheets = files.filter((f) => f.includes("/ships/"));
    const withDrones = sheets.filter((f) => (built.get(f)!.data as { view?: { droneControl: unknown } }).view?.droneControl != null);
    expect(withDrones.some((f) => f.includes("/ships/asset/"))).toBe(true);
    expect(sheets.some((f) => f.includes("/ships/fit/"))).toBe(true);
  });

  it("names nobody real: invented pilots, example.com, ids below the player range", async () => {
    for (const file of built.keys()) {
      const text = await readFile(path.join(DIR, file), "utf8");
      for (const email of text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []) expect(email, file).toMatch(/@example\.com$/);
    }
    const characters = (built.get("characters.json")!.data as { characters: { id: number; name: string }[] }).characters;
    for (const c of characters) {
      expect(c.name).toMatch(/^Example Pilot /);
      expect(c.id).toBeLessThan(90_000_000);
    }
  });
});
