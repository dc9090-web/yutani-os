import "@mantine/core/styles.css";
import "./globals.css";
import type { ReactNode } from "react";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { chakraPetch, jetbrainsMono, michroma } from "./fonts.js";
import { theme } from "./theme.js";
import { Shell } from "./components/Shell.js";
import { readSession } from "../lib/auth/session.js";
import { listCharacters } from "../lib/db/characters.js";
import { listAccounts } from "../lib/db/accounts.js";
import { latestRuns } from "../lib/db/sync-runs.js";
import { getSdeMeta } from "../lib/sde/repo.js";
import { systemState } from "../lib/view/system.js";
import type { SystemStripProps } from "./components/SystemStrip.js";
import { groupByAccount, toCharacterView, type CharacterGroup } from "../lib/view/characters.js";

export const metadata = { title: "Yutani OS", description: "EVE Online command centre" };
export const dynamic = "force-dynamic";

interface ShellData { groups: CharacterGroup[]; activeId: number | null; system: SystemStripProps }

async function loadShellData(): Promise<ShellData> {
  const now = new Date().toISOString();
  try {
    const [session, characters, accounts, runs, sdeMeta] = await Promise.all([
      readSession(), listCharacters(), listAccounts(), latestRuns(), getSdeMeta(),
    ]);
    return {
      groups: groupByAccount(characters.map(toCharacterView), accounts),
      activeId: session?.activeCharacterId ?? null,
      system: { ...systemState(runs), sdeBuild: sdeMeta?.buildNumber ?? null, characters: characters.length, now },
    };
  } catch (e) {
    console.error("[layout] shell data unavailable:", (e as Error).message);
    return { groups: [], activeId: null, system: { sync: "none", esi: "none", sdeBuild: null, characters: 0, now } };
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { groups, activeId, system } = await loadShellData();
  return (
    <html lang="en" className={`${michroma.variable} ${chakraPetch.variable} ${jetbrainsMono.variable}`} {...mantineHtmlProps}>
      <head><ColorSchemeScript forceColorScheme="dark" /></head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark">
          <Shell groups={groups} activeId={activeId} system={system}>{children}</Shell>
        </MantineProvider>
      </body>
    </html>
  );
}
