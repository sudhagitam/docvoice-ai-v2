/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        ink: {
          950: "#080B0F",
          900: "#0D1117",
          800: "#161B22",
          700: "#21262D",
          600: "#30363D",
          500: "#484F58",
          400: "#6E7681",
          300: "#8B949E",
          200: "#B1BAC4",
          100: "#C9D1D9",
          50:  "#F0F6FF",
        },
        voice: {
          DEFAULT: "#3ECFCF",
          dark:    "#2BA8A8",
          light:   "#7EEAEA",
          glow:    "rgba(62,207,207,0.18)",
        },
        amber: {
          DEFAULT: "#F5A623",
          light:   "#FFC859",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow":  "spin 8s linear infinite",
        "eq":         "eq 1.2s ease-in-out infinite",
      },
      keyframes: {
        eq: {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%":       { transform: "scaleY(1)" },
        },
      },
    },
  },
  plugins: [],
};
