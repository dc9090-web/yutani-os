import { createTheme } from "@mantine/core";

// Mantine theme for the "Midnight" design system. Surfaces/borders are driven mostly
// by CSS variables in globals.css (matching the prototype's token approach); this sets
// the type, the brand (accent #4d8dff at shade 4), radii, and a navy dark scale.
export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 4,
  fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  headings: {
    fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif",
    fontWeight: "600",
  },
  defaultRadius: "md",
  radius: { sm: "6px", md: "8px", lg: "10px" },
  colors: {
    brand: [
      "#eaf2ff", "#d3e1ff", "#a5c0ff", "#739dff", "#4d8dff",
      "#3b82f6", "#2f6fe0", "#2459c4", "#1c46a0", "#12306f",
    ],
    // Light → dark; tuned to the Midnight surfaces (text at 0, page near 8/9).
    dark: [
      "#e9f0ff", "#dfe7f5", "#8aa0c6", "#5b6b86", "#2c4068",
      "#1d2c4a", "#13203a", "#0e1830", "#070d1c", "#05080f",
    ],
  },
});
