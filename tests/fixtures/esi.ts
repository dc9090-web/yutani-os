import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "esi");

/** Loads tests/fixtures/esi/<name>.json. Hand-written from the schemas in the ESI research. */
export function esiFixture<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(dir, `${name}.json`), "utf8")) as T;
}
