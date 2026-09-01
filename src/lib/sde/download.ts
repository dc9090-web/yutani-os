import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { sdeUserAgent } from "./version.js";

/** No tenant segment on this path — the tenant-qualified "latest" URL returns 403. 302 to the build-pinned zip. */
export const SDE_ZIP_URL = "https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip";

/** Streams the ~95 MB archive straight to disk; it is never held in memory. */
export async function downloadSde(destPath: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(SDE_ZIP_URL, { headers: { "user-agent": sdeUserAgent() }, redirect: "follow" });
  if (!res.ok) throw new Error(`SDE download failed: ${res.status} ${res.statusText}`);
  if (!res.body) throw new Error("SDE download returned an empty body");
  const source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  await pipeline(source, createWriteStream(destPath));
}
