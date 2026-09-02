import type { SyncJob } from "../scheduler.js";
import { sdeUpdateJob } from "./sde-update.js";
import { marketPricesJob } from "./market-prices.js";
import { killmailBackfillJob } from "./killmail-backfill.js";
import { characterInfoJob } from "./character-info.js";
import { skillsJob } from "./skills.js";
import { clonesJob } from "./clones.js";
import { assetsJob } from "./assets.js";
import { fittingsJob } from "./fittings.js";
import { walletJob } from "./wallet.js";
import { locationJob } from "./location.js";
import { killmailsJob } from "./killmails.js";

/**
 * Registration order. The three global jobs come first so a fresh database imports the SDE, pulls
 * prices and starts the zKillboard backfill on the very first tick; the character jobs are
 * staggered by the scheduler, so with 8 jobs x 4 characters the per-tick fan-out stays small.
 */
export const ALL_JOBS: SyncJob[] = [
  sdeUpdateJob, marketPricesJob, killmailBackfillJob,
  characterInfoJob, skillsJob, clonesJob, assetsJob, fittingsJob, walletJob, locationJob, killmailsJob,
];
