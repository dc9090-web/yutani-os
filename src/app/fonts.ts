import { Inter, Poppins, Space_Grotesk } from "next/font/google";

// Midnight type system: Inter body, Poppins headings/values, Space Grotesk for the
// "INTELLIGENCE" wordmark. Exposed as CSS variables consumed by theme.ts + globals.css.
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-grotesk",
  display: "swap",
});
