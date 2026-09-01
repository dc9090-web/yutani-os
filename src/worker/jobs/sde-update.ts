import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import type { GlobalSyncJob } from "../scheduler.js";
import { fetchLatestBuild, type SdeBuild } from "../../lib/sde/version.js";
import { downloadSde } from "../../lib/sde/download.js";
import { importSde, type ImportResult } from "../../lib/sde/import.js";
import { getSdeMeta } from "../../lib/sde/repo.js";
import { getPool } from "../../lib/db/client.js";

export const SDE_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Every side effect is injected so the job is unit-tested with fakes. */
export interface SdeUpdateDeps {
  fetchLatestBuild: () => Promise<SdeBuild>;
  getSdeMeta: () => Promise<{ buildNumber: number } | null>;
  downloadSde: (destPath: string) => Promise<void>;
  importSde: (zipPath: string) => Promise<ImportResult>;
  tmpFile: (buildNumber: number) => string;
  removeFile: (filePath: string) => Promise<void>;
  log?: (msg: string) => void;
}

/**
 * Polls the build pointer and re-imports only when the build number changed. On an empty database
 * `getSdeMeta()` is null, so the worker's first tick imports the SDE. Errors propagate: the
 * scheduler writes them to the job's sync_runs row and the previous SDE stays live.
 */
export function createSdeUpdateJob(deps: SdeUpdateDeps): GlobalSyncJob {
  const log = deps.log ?? ((): void => {});
  return {
    name: "sde-update",
    scope: "global",
    intervalMs: SDE_UPDATE_INTERVAL_MS,
    async run() {
      const latest = await deps.fetchLatestBuild();
      const meta = await deps.getSdeMeta();
      if (meta && meta.buildNumber === latest.buildNumber) {
        log(`sde-update: build ${latest.buildNumber} is already imported`);
        return 0;
      }
      const zipPath = deps.tmpFile(latest.buildNumber);
      log(`sde-update: ${meta ? `build ${meta.buildNumber}` : "no SDE"} to build ${latest.buildNumber}; downloading`);
      try {
        await deps.downloadSde(zipPath);
        const result = await deps.importSde(zipPath);
        log(`sde-update: imported build ${result.buildNumber}`);
        return result.counts.sde_types ?? 0;
      } finally {
        await deps.removeFile(zipPath);
      }
    },
  };
}

export const sdeUpdateJob: GlobalSyncJob = createSdeUpdateJob({
  fetchLatestBuild: () => fetchLatestBuild(),
  getSdeMeta: async () => await getSdeMeta(),
  downloadSde: (destPath) => downloadSde(destPath),
  importSde: (zipPath) => importSde(zipPath, getPool(), (msg) => console.log(`[worker] ${msg}`)),
  tmpFile: (buildNumber) => path.join(os.tmpdir(), `eve-sde-${buildNumber}.zip`),
  removeFile: (filePath) => rm(filePath, { force: true }),
  log: (msg) => console.log(`[worker] ${msg}`),
});
