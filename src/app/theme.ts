import { createTheme } from "@mantine/core";

// Mantine theme for the Yutani OS design system. Surfaces/borders are driven mostly by CSS
// variables in globals.css; this sets the type, the brand (amber #f5a623 at shade 4), tight radii,
// and a warm-black dark scale matching the tokens.
export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 4,
  fontFamily: "var(--font-body), ui-monospace, SFMono-Regular, Menlo, monospace",
  headings: {
    fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
    fontWeight: "600",
  },
  defaultRadius: "sm",
  radius: { sm: "2px", md: "2px", lg: "4px" },
  colors: {
    brand: [
      "#fff4df", "#ffe4b3", "#ffd27a", "#fbbd4a", "#f5a623",
      "#e0941a", "#c47f12", "#a3680d", "#7f5109", "#5a3905",
    ],
    // Light → dark; tuned to the Yutani surfaces (text at 0, page near 8/9).
    dark: [
      "#f4ecd9", "#e8dfc8", "#b7a37c", "#6a5d45", "#4a3d1f",
      "#2d2616", "#1c1811", "#14110b", "#0a0806", "#060402",
    ],
  },
});
