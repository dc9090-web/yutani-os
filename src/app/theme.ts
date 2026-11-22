import { createTheme } from "@mantine/core";

// Mantine theme for the Yutani OS redesign (docs/design-handoff). Mantine only draws the account
// menu and the settings forms; surfaces and borders come from the --yo- tokens in globals.css. This
// sets the type, the one accent (amber #F5A524 at shade 4), the control radii and a cool dark scale
// matching the tokens (text at 0, page ground at 8/9).
export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 4,
  fontFamily: "var(--yo-font-ui)",
  fontFamilyMonospace: "var(--yo-font-mono)",
  headings: { fontFamily: "var(--yo-font-display)", fontWeight: "600" },
  defaultRadius: "sm",
  radius: { xs: "3px", sm: "6px", md: "6px", lg: "8px" },
  colors: {
    brand: [
      "#fff5e0", "#ffe6b3", "#fdd585", "#f9bf4f", "#F5A524",
      "#dd9115", "#bf7c0f", "#9c640b", "#784c07", "#553504",
    ],
    dark: [
      "#E6E9ED", "#C9CED6", "#9AA3AE", "#7C8794", "#2A313B",
      "#1C2128", "#1A1F26", "#111418", "#0E1114", "#0A0C0F",
    ],
  },
});
