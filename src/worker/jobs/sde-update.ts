import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import type { GlobalSyncJob } from "../scheduler.js";
import { fetchLatestBuild, type SdeBuild } from "../../lib/sde/version.js";
import { downloadSde } from "../../lib/sde/download.js";
import { importSde, type ImportResult } from "../../lib/sde/import.js";
import { emptySdeTables, getSdeMeta } from "../../lib/sde/repo.js";
import { SDE_TABLES } from "../../lib/sde/ddl.js";
import { getPool } from "../../lib/db/client.js";

export const SDE_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const SDE_UPDATE_RETRY_MS = 10 * 60 * 1000;

/** Every side effect is injected so the job is unit-tested with fakes. */
export interface SdeUpdateDeps {
  fetchLatestBuild: () => Promise<SdeBuild>;
  getSdeMeta: () => Promise<{ buildNumber: number } | null>;
  /** SDE tables with no rows — ones the importer learned about after the stored build was loaded. */
  emptyTables: () => Promise<string[]>;
  downloadSde: (destPath: string) => Promise<void>;
  importSde: (zipPath: string) => Promise<ImportResult>;
  tmpFile: (buildNumber: number) => string;
  removeFile: (filePath: string) => Promise<void>;
  log?: (msg: string) => void;
}

/**
 * Polls the build pointer and re-imports when the build number changed, or when a table the
 * importer fills is still empty (a release that added a table: the same build has to be read again
 * to fill it). On an empty database `getSdeMeta()` is null, so the worker's first tick imports the
 * SDE. Errors propagate: the
 * scheduler writes them to the job's sync_runs row and the previous SDE stays live.
 */
export function createSdeUpdateJob(deps: SdeUpdateDeps): GlobalSyncJob {
  const log = deps.log ?? ((): void => {});
  return {
    name: "sde-update",
    scope: "global",
    intervalMs: SDE_UPDATE_INTERVAL_MS,
    retryMs: SDE_UPDATE_RETRY_MS,
    async run() {
      const latest = await deps.fetchLatestBuild();
      const meta = await deps.getSdeMeta();
      if (meta && meta.buildNumber === latest.buildNumber) {
        const empty = await deps.emptyTables();
        if (empty.length === 0) {
          log(`sde-update: build ${latest.buildNumber} is already imported`);
          return 0;
        }
        log(`sde-update: build ${latest.buildNumber} is imported but ${empty.join(", ")} ${empty.length === 1 ? "is" : "are"} empty; importing again`);
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
  emptyTables: () => emptySdeTables(SDE_TABLES),
  downloadSde: (destPath) => downloadSde(destPath),
  importSde: (zipPath) => importSde(zipPath, getPool(), (msg) => console.log(`[worker] ${msg}`)),
  tmpFile: (buildNumber) => path.join(os.tmpdir(), `eve-sde-${buildNumber}.zip`),
  removeFile: (filePath) => rm(filePath, { force: true }),
  log: (msg) => console.log(`[worker] ${msg}`),
});
