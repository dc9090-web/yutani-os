import { getConfig } from "../lib/config.js";
import { createEsiClient } from "../lib/esi/index.js";
import { listCharacters, setTokenStatus } from "../lib/db/characters.js";
import { startRun, finishRun } from "../lib/db/sync-runs.js";
import { Scheduler } from "./scheduler.js";
import { ALL_JOBS } from "./jobs/index.js";

const TICK_MS = 30_000;
getConfig();   // fail fast on missing env
const scheduler = new Scheduler({
  jobs: ALL_JOBS, esi: createEsiClient(), listCharacters, startRun, finishRun,
  markNeedsReauth: (id) => setTokenStatus(id, "needs_reauth"),
});
console.log(`[worker] started with ${ALL_JOBS.length} jobs`);
async function loop() {
  try { await scheduler.tick(); } catch (e) { console.error("[worker] tick failed:", e); }
  setTimeout(loop, TICK_MS);
}
void loop();
