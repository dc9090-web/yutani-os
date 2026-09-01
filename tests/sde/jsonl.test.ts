import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeZip } from "../../scripts/lib/zip.js";
import { readJsonlMember } from "../../src/lib/sde/jsonl.js";

let dir: string;
let zipPath: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "eve-jsonl-"));
  zipPath = path.join(dir, "mini.zip");
  await writeZip(zipPath, [
    { name: "_sde.jsonl", content: '{"_key":"sde","buildNumber":3484357,"releaseDate":"2026-08-28T11:07:12Z"}\n' },
    // blank line in the middle, non-ASCII payload, trailing newline
    { name: "types.jsonl", content: '{"_key":587,"name":{"en":"Rifter","ja":"リフター"}}\n\n{"_key":519,"name":{"en":"Gyrostabilizer II"}}\n' },
    { name: "big.jsonl", content: Array.from({ length: 5000 }, (_, i) => `{"_key":${i}}`).join("\n") + "\n" },
  ]);
});
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

async function collect(member: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for await (const r of readJsonlMember(zipPath, member)) out.push(r);
  return out;
}

describe("readJsonlMember", () => {
  it("streams parsed records, skipping blank lines", async () => {
    const rows = await collect("types.jsonl");
    expect(rows).toEqual([
      { _key: 587, name: { en: "Rifter", ja: "リフター" } },
      { _key: 519, name: { en: "Gyrostabilizer II" } },
    ]);
  });

  it("reads a member with a string _key", async () => {
    expect(await collect("_sde.jsonl")).toEqual([{ _key: "sde", buildNumber: 3484357, releaseDate: "2026-08-28T11:07:12Z" }]);
  });

  it("streams a large member without buffering it", async () => {
    let n = 0;
    let last = -1;
    for await (const r of readJsonlMember(zipPath, "big.jsonl")) { n++; last = r._key as number; }
    expect(n).toBe(5000);
    expect(last).toBe(4999);
  });

  it("supports early break without leaking the zip handle", async () => {
    const seen: unknown[] = [];
    for await (const r of readJsonlMember(zipPath, "big.jsonl")) { seen.push(r._key); if (seen.length === 3) break; }
    expect(seen).toEqual([0, 1, 2]);
    // a second full read still works, proving the first iteration released its handle
    expect((await collect("types.jsonl")).length).toBe(2);
  });

  it("throws when the member is missing", async () => {
    await expect(collect("nope.jsonl")).rejects.toThrow(/zip member not found: nope\.jsonl/);
  });
});
