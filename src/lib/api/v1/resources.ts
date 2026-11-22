import { getConfig } from "../../config.js";
import { listCharacters } from "../../db/characters.js";
import type { FitData } from "../../ships/load.js";
import { loadAssets } from "../../pages/assets.js";
import { loadCharacters } from "../../pages/characters.js";
import { loadClones } from "../../pages/clones.js";
import { loadOverview } from "../../pages/overview.js";
import { loadAssetSheet, loadFittingSheet, loadShips } from "../../pages/ships.js";
import { loadSkills, loadTraining, loadTrainingOverview } from "../../pages/skills.js";
import { loadWalletRows, loadWalletSummary, WALLET_MAX_LIMIT, type WalletKind } from "../../pages/wallet.js";
import type { FitSheetView } from "../../view/fit-sheet.js";
import { API_VERSION, type Resource } from "./respond.js";

/**
 * Every `/api/v1` resource, built once here so a route and the sync list can never disagree about
 * a path or about what is behind it.
 */

export const meResource = (who: { email: string }): Resource => ({
  path: "/api/v1/me", clock: false,
  build: async () => ({ email: who.email, ownerInitials: getConfig().ownerInitials, apiVersion: API_VERSION }),
});

export const charactersResource = (): Resource => ({
  path: "/api/v1/characters", clock: false,
  build: async () => ({ characters: await loadCharacters() }),
});

export const overviewResource = (): Resource => ({
  path: "/api/v1/overview", clock: true,
  build: (now) => loadOverview(now),
});

export const trainingOverviewResource = (): Resource => ({
  path: "/api/v1/training-overview", clock: true,
  build: async (now) => loadTrainingOverview(await listCharacters(), now),
});

const base = (characterId: number): string => `/api/v1/characters/${characterId}`;

export const skillsResource = (characterId: number): Resource => ({
  path: `${base(characterId)}/skills`, clock: true,
  build: (now) => loadSkills(characterId, now),
});

export const trainingResource = (characterId: number): Resource => ({
  path: `${base(characterId)}/training`, clock: true,
  build: (now) => loadTraining(characterId, now),
});

export const clonesResource = (characterId: number): Resource => ({
  path: `${base(characterId)}/clones`, clock: false,
  build: () => loadClones(characterId),
});

export const assetsResource = (characterId: number): Resource => ({
  path: `${base(characterId)}/assets`, clock: false,
  build: () => loadAssets(characterId),
});

/** The balance above the lists. Its own resource, so a balance change does not re-send 500 rows twice. */
export const walletSummaryResource = (characterId: number): Resource => ({
  path: `${base(characterId)}/wallet`, clock: false,
  build: () => loadWalletSummary(characterId),
});

export const walletRowsResource = (characterId: number, kind: WalletKind, offset = 0, limit = WALLET_MAX_LIMIT): Resource => ({
  path: `${base(characterId)}/wallet?kind=${kind}&offset=${offset}&limit=${limit}`, clock: false,
  build: () => loadWalletRows(characterId, kind, offset, limit),
});

/** `fitData` is for the sync list, which builds every ship resource of a character off one read. */
export const shipsResource = (characterId: number, fitData?: () => Promise<FitData>): Resource => ({
  path: `${base(characterId)}/ships`, clock: false,
  build: async () => loadShips(characterId, await fitData?.()),
});

/** A sheet that rendered, or one the engine could not compute (the page's "Could not compute"). */
export type ShipDetailData = { kind: "ok"; view: FitSheetView } | { kind: "error"; title: string };
export type ShipDetailKind = "asset" | "fit";

export const shipDetailPath = (characterId: number, kind: ShipDetailKind, id: number): string => `${base(characterId)}/ships/${kind}/${id}`;

export const shipDetailResource = (characterId: number, kind: ShipDetailKind, id: number, fitData?: () => Promise<FitData>): Resource<ShipDetailData> => ({
  path: shipDetailPath(characterId, kind, id), clock: false,
  build: async () => {
    const data = await fitData?.();
    const result = kind === "asset" ? await loadAssetSheet(characterId, id, data) : await loadFittingSheet(characterId, id, data);
    return result.kind === "notFound" ? null : result;
  },
});
