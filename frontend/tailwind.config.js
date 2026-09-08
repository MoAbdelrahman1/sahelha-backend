/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        pearl: "#FAF9FD",
        // Landing screen tokens (src/features/landing) — untouched, still used
        // by the not-yet-rewritten marketing copy.
        muted: "#707070",
        soft: "rgba(91,156,235,0.08)",
        brandBlue: "#5B9CEB",
        brandBlueDeep: "#2563EB",

        // Sahelha design-system tokens (see src/styles/theme.ts) — light mode.
        // High-contrast mode is applied via inline `palette(true)` values
        // (RN has no CSS media-query equivalent), not a second Tailwind set.
        ink: "#0E0E14",
        secondary: "#5B5B68",
        surface: "#F7F7FB",
        line: "#ECECF2",
        primary: "#33409B",
      },
      fontFamily: {
        cairoBold: ["Cairo_700Bold"],
        cairoExtraBold: ["Cairo_800ExtraBold"],
        cairoBlack: ["Cairo_900Black"],
        plex: ["IBMPlexSansArabic_400Regular"],
        plexMedium: ["IBMPlexSansArabic_500Medium"],
        plexSemiBold: ["IBMPlexSansArabic_600SemiBold"],
        plexBold: ["IBMPlexSansArabic_700Bold"],
      },
    },
  },
  plugins: [],
}
