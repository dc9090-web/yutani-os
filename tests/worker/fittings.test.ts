import { describe, it, expect, vi } from "vitest";
import { createFittingsJob, fittingsJob, FITTINGS_INTERVAL_MS, FITTINGS_RETRY_MS, type FittingsJobDeps } from "../../src/worker/jobs/fittings.js";
import type { FittingRow } from "../../src/lib/db/character-fittings.js";
import { esiFixture } from "../fixtures/esi.js";
import { EsiUnavailableError } from "../../src/lib/esi/client.js";

const CID = 669539978;

function harness(scopes: string[] = ["esi-fittings.read_fittings.v1"]) {
  const writes: FittingRow[][] = [];
  const paths: string[] = [];
  const deps: FittingsJobDeps = {
    getCharacter: async () => ({ scopes }),
    replaceFittings: async (_id, f) => { writes.push(f); return 6; },
  };
  const esi = { get: vi.fn(async (path: string) => { paths.push(path); return { data: esiFixture("fittings") }; }) };
  return { job: createFittingsJob(deps), esi, writes, paths };
}

describe("fittings job", () => {
  it("is a 6-hourly character job that retries in 15 minutes", () => {
    expect(fittingsJob.name).toBe("fittings");
    expect(fittingsJob.intervalMs).toBe(FITTINGS_INTERVAL_MS);
    expect(FITTINGS_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
    expect(fittingsJob.retryMs).toBe(FITTINGS_RETRY_MS);
    expect(FITTINGS_RETRY_MS).toBe(15 * 60 * 1000);
  });
  it("stores items in file order with idx, including the Invalid flag", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(6);
    expect(h.paths).toEqual([`/characters/${CID}/fittings`]);
    const [rifter, vexor] = h.writes[0];
    expect(rifter).toMatchObject({ fittingId: 4021, name: "Rifter — cheap tackle", description: "", shipTypeId: 587 });
    expect(rifter.items.map((i) => [i.idx, i.flag])).toEqual([
      [0, "HiSlot0"], [1, "HiSlot1"], [2, "MedSlot0"], [3, "LoSlot0"], [4, "RigSlot0"], [5, "Cargo"], [6, "Invalid"],
    ]);
    expect(rifter.items[5].quantity).toBe(400);
    expect(vexor.items).toEqual([{ idx: 0, typeId: 2456, quantity: 5, flag: "DroneBay" }]);
  });
  it("writes an empty list when the character has no fittings", async () => {
    const h = harness();
    h.esi.get = vi.fn(async () => ({ data: [] }));
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0]).toEqual([]);
  });
  it("returns 0 without calling ESI when the scope is missing", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.paths).toEqual([]);
    expect(h.writes).toEqual([]);
  });
  it("lets an ESI outage propagate so the scheduler records it", async () => {
    const h = harness();
    h.esi.get = vi.fn(async () => { throw new EsiUnavailableError("/characters/1/fittings", Date.now() + 60_000); });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
    expect(h.writes).toEqual([]);
  });
});
