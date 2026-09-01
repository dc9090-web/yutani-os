import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deserialiseDogmaData, type DogmaData, type DogmaDataJson } from "../../src/lib/dogma/data.js";

export const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "dogma");

export type FixtureName = "rifter" | "tengu";

const cache = new Map<FixtureName, DogmaData>();

/** A committed DogmaData snapshot, parsed once per process. Treat the result as read-only. */
export function fixtureData(name: FixtureName): DogmaData {
  let data = cache.get(name);
  if (!data) {
    const json = JSON.parse(readFileSync(path.join(FIXTURE_DIR, `${name}.json`), "utf8")) as DogmaDataJson;
    data = deserialiseDogmaData(json);
    cache.set(name, data);
  }
  return data;
}
