import "@mantine/core/styles.css";
import "./globals.css";
import type { ReactNode } from "react";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { inter, poppins, spaceGrotesk } from "./fonts.js";
import { theme } from "./theme.js";
import { Shell } from "./components/Shell.js";
import { readSession } from "../lib/auth/session.js";
import { listCharacters } from "../lib/db/characters.js";
import { listAccounts } from "../lib/db/accounts.js";
import { groupByAccount, toCharacterView, type CharacterGroup } from "../lib/view/characters.js";

export const metadata = { title: "EVE", description: "EVE Online command centre" };
export const dynamic = "force-dynamic";

async function loadShellData(): Promise<{ groups: CharacterGroup[]; activeId: number | null }> {
  try {
    const [session, characters, accounts] = await Promise.all([readSession(), listCharacters(), listAccounts()]);
    return { groups: groupByAccount(characters.map(toCharacterView), accounts), activeId: session?.activeCharacterId ?? null };
  } catch (e) {
    console.error("[layout] shell data unavailable:", (e as Error).message);
    return { groups: [], activeId: null };
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { groups, activeId } = await loadShellData();
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${spaceGrotesk.variable}`} {...mantineHtmlProps}>
      <head><ColorSchemeScript forceColorScheme="dark" /></head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark">
          <Shell groups={groups} activeId={activeId}>{children}</Shell>
        </MantineProvider>
      </body>
    </html>
  );
}
