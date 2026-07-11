/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        pearl: "#FAF9FD",
        primary: "#6D28D9",
        accent: "#4F46E5",
        // Landing screen tokens (src/features/landing) — white + soft blue scheme
        ink: "#000000",
        muted: "#707070",
        soft: "rgba(91,156,235,0.08)",
        line: "rgba(37,99,235,0.15)",
        brandBlue: "#5B9CEB",
        brandBlueDeep: "#2563EB",
      },
    },
  },
  plugins: [],
}
