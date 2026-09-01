export const SDE_LATEST_URL = "https://developers.eveonline.com/static-data/tranquility/latest.jsonl";

export interface SdeBuild { buildNumber: number; releaseDate: Date }

/** CCP asks callers to identify themselves; the SDE endpoints reuse the ESI user agent. */
export function sdeUserAgent(): string {
  return process.env.ESI_USER_AGENT ?? "EVE-Plasma (dac9dc@gmail.com)";
}

/**
 * Reads the 80-byte build pointer:
 *   {"_key": "sde", "buildNumber": 3484357, "releaseDate": "2026-08-28T11:07:12Z"}
 * Cached 5 minutes server-side; a non-2xx is an error and must not trigger a download.
 */
export async function fetchLatestBuild(fetchImpl: typeof fetch = fetch): Promise<SdeBuild> {
  const res = await fetchImpl(SDE_LATEST_URL, {
    headers: { "user-agent": sdeUserAgent(), accept: "application/jsonlines+json, application/json" },
  });
  if (!res.ok) throw new Error(`SDE version poll failed: ${res.status} ${res.statusText}`);
  const body = await res.text();
  const line = body.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (!line) throw new Error("SDE version poll returned an empty body");
  const record = JSON.parse(line) as { buildNumber?: unknown; releaseDate?: unknown };
  if (typeof record.buildNumber !== "number" || typeof record.releaseDate !== "string") {
    throw new Error(`SDE version poll returned an unexpected record: ${line}`);
  }
  return { buildNumber: record.buildNumber, releaseDate: new Date(record.releaseDate) };
}
