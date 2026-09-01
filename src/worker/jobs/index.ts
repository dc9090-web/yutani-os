import type { SyncJob } from "../scheduler.js";
import { sdeUpdateJob } from "./sde-update.js";
import { characterInfoJob } from "./character-info.js";
import { skillsJob } from "./skills.js";
import { clonesJob } from "./clones.js";
import { assetsJob } from "./assets.js";
import { fittingsJob } from "./fittings.js";
import { walletJob } from "./wallet.js";
import { locationJob } from "./location.js";

/**
 * Registration order. sde-update comes first so a fresh database imports the SDE on the very first
 * tick; the character jobs are staggered by the scheduler, so with 7 jobs x 4 characters the
 * per-tick fan-out stays small.
 */
export const ALL_JOBS: SyncJob[] = [
  sdeUpdateJob, characterInfoJob, skillsJob, clonesJob, assetsJob, fittingsJob, walletJob, locationJob,
];
