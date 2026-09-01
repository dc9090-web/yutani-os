import { getConfig } from "../lib/config.js";
import { createEsiClient } from "../lib/esi/index.js";
import { listCharacters, setTokenStatus } from "../lib/db/characters.js";
import { startRun, finishRun } from "../lib/db/sync-runs.js";
import { Scheduler } from "./scheduler.js";
import { characterInfoJob } from "./jobs/character-info.js";
import { sdeUpdateJob } from "./jobs/sde-update.js";

const TICK_MS = 30_000;
getConfig();   // fail fast on missing env
const scheduler = new Scheduler({
  // sde-update first: on a fresh database the first tick imports the SDE.
  jobs: [sdeUpdateJob, characterInfoJob], esi: createEsiClient(), listCharacters, startRun, finishRun,
  markNeedsReauth: (id) => setTokenStatus(id, "needs_reauth"),
});
console.log("[worker] started");
async function loop() {
  try { await scheduler.tick(); } catch (e) { console.error("[worker] tick failed:", e); }
  setTimeout(loop, TICK_MS);
}
void loop();
