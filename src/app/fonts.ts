import { Chakra_Petch, JetBrains_Mono, Michroma } from "next/font/google";

// Yutani OS type system (design hand-back 2026-10-01): Michroma for panel labels, nav and buttons;
// Chakra Petch for titles, names and values; JetBrains Mono for body copy and every table/readout.
// globals.css aliases the older --font-inter / --font-poppins / --font-grotesk names onto these.
export const michroma = Michroma({ subsets: ["latin"], weight: "400", variable: "--font-label", display: "swap" });
export const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
