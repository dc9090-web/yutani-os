export const SDE_LATEST_URL = "https://developers.eveonline.com/static-data/tranquility/latest.jsonl";

export interface SdeBuild { buildNumber: number; releaseDate: Date }

/** CCP asks callers to identify themselves; the SDE endpoints reuse the ESI user agent. */
export function sdeUserAgent(): string {
  return process.env.ESI_USER_AGENT ?? "EVE-Plasma (dac9dc@gmail.com)";
}

/**
 * Validates and parses a build-pointer record ({buildNumber, releaseDate}). Shared by the version
 * poll (`fetchLatestBuild`) and the importer's `_sde.jsonl` reader so both apply the same checks
 * and a malformed build never gets past parsing.
 */
export function parseSdeBuild(record: { buildNumber?: unknown; releaseDate?: unknown }): SdeBuild {
  if (typeof record.buildNumber !== "number" || typeof record.releaseDate !== "string") {
    throw new Error(`SDE build record is an unexpected shape: ${JSON.stringify(record)}`);
  }
  if (!Number.isInteger(record.buildNumber) || record.buildNumber <= 0) {
    throw new Error(`SDE build record has an invalid buildNumber: ${record.buildNumber}`);
  }
  const releaseDate = new Date(record.releaseDate);
  if (Number.isNaN(releaseDate.getTime())) {
    throw new Error(`SDE build record has an invalid releaseDate: ${record.releaseDate}`);
  }
  return { buildNumber: record.buildNumber, releaseDate };
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
  return parseSdeBuild(JSON.parse(line) as { buildNumber?: unknown; releaseDate?: unknown });
}
