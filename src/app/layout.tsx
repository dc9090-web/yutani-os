import "@mantine/core/styles.css";
import "./globals.css";
import type { ReactNode } from "react";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { inter, jetbrainsMono, spaceGrotesk } from "./fonts.js";
import { theme } from "./theme.js";
import { Shell, type ShellAccount } from "./components/Shell.js";
import { listCharacters } from "../lib/db/characters.js";
import { latestRuns } from "../lib/db/sync-runs.js";
import { getSdeMeta } from "../lib/sde/repo.js";
import { systemState } from "../lib/view/system.js";
import { getServerStatus } from "../lib/db/server-status.js";
import { serverView } from "../lib/view/server.js";
import type { SystemStripProps } from "./components/SystemStrip.js";
import { getConfig } from "../lib/config.js";

export const metadata = { title: "Yutani OS", description: "EVE Online command centre" };
export const dynamic = "force-dynamic";

interface ShellData { account: ShellAccount; system: SystemStripProps }

async function loadShellData(): Promise<ShellData> {
  const now = new Date().toISOString();
  try {
    const [characters, runs, sdeMeta, server] = await Promise.all([listCharacters(), latestRuns(), getSdeMeta(), getServerStatus()]);
    return {
      account: {
        initials: getConfig().ownerInitials,
        needsReauth: characters.filter((c) => c.tokenStatus === "needs_reauth").length,
      },
      system: { ...systemState(runs), sdeBuild: sdeMeta?.buildNumber ?? null, characters: characters.length,
        players: serverView(server, new Date(now))?.label ?? null, now },
    };
  } catch (e) {
    console.error("[layout] shell data unavailable:", (e as Error).message);
    return { account: { initials: null, needsReauth: 0 }, system: { sync: "none", esi: "none", sdeBuild: null, characters: 0, players: null, now } };
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { account, system } = await loadShellData();
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`} {...mantineHtmlProps}>
      <head><ColorSchemeScript forceColorScheme="dark" /></head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark">
          <Shell account={account} system={system}>{children}</Shell>
        </MantineProvider>
      </body>
    </html>
  );
}
