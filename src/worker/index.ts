import { getConfig } from "../lib/config.js";
import { createEsiClient } from "../lib/esi/index.js";
import { listCharacters } from "../lib/db/characters.js";
import { startRun, finishRun } from "../lib/db/sync-runs.js";
import { Scheduler } from "./scheduler.js";
import { characterInfoJob } from "./jobs/character-info.js";

const TICK_MS = 30_000;
getConfig();   // fail fast on missing env
const scheduler = new Scheduler({ jobs: [characterInfoJob], esi: createEsiClient(), listCharacters, startRun, finishRun });
console.log("[worker] started");
async function loop() {
  try { await scheduler.tick(); } catch (e) { console.error("[worker] tick failed:", e); }
  setTimeout(loop, TICK_MS);
}
void loop();
