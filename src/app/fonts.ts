import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

// Yutani OS type system (redesign hand-off 2026-11-22, docs/design-handoff/DESIGN_SYSTEM.md):
// Inter for names and prose, Space Grotesk for headings, JetBrains Mono for every figure, tag and
// readout. globals.css builds --yo-font-ui / --yo-font-display / --yo-font-mono on these variables.
export const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter-face", display: "swap" });
export const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-grotesk-face", display: "swap" });
export const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-face", display: "swap" });
