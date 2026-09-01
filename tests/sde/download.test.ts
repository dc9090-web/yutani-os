import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { downloadSde, SDE_ZIP_URL } from "../../src/lib/sde/download.js";

let dir: string;
beforeAll(async () => { dir = await mkdtemp(path.join(os.tmpdir(), "eve-dl-")); });
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

describe("downloadSde", () => {
  it("streams the response body to disk", async () => {
    const fetchImpl = vi.fn(async () => new Response("PK pretend zip", { status: 200 }));
    const dest = path.join(dir, "sde.zip");
    await downloadSde(dest, fetchImpl as unknown as typeof fetch);
    expect(await readFile(dest, "utf8")).toBe("PK pretend zip");
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(SDE_ZIP_URL);
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404, statusText: "Not Found" }));
    await expect(downloadSde(path.join(dir, "x.zip"), fetchImpl as unknown as typeof fetch)).rejects.toThrow(/404/);
  });
});
