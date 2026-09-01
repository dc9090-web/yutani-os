import "@mantine/core/styles.css";
import "./globals.css";
import type { ReactNode } from "react";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { inter, poppins, spaceGrotesk } from "./fonts.js";
import { theme } from "./theme.js";

export const metadata = { title: "EVE", description: "EVE Online command centre" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${spaceGrotesk.variable}`} {...mantineHtmlProps}>
      <head><ColorSchemeScript forceColorScheme="dark" /></head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="dark">{children}</MantineProvider>
      </body>
    </html>
  );
}
