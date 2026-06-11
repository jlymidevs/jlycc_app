import type { Config } from "tailwindcss";

// gray/white/blue are remapped to CSS variables so every existing
// `text-gray-900` / `bg-white` / `bg-blue-600` usage across the app
// follows the active theme (light/dark) automatically.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        white: "var(--tw-white)",
        gray: {
          50: "var(--tw-gray-50)",
          100: "var(--tw-gray-100)",
          200: "var(--tw-gray-200)",
          300: "var(--tw-gray-300)",
          400: "var(--tw-gray-400)",
          500: "var(--tw-gray-500)",
          600: "var(--tw-gray-600)",
          700: "var(--tw-gray-700)",
          800: "var(--tw-gray-800)",
          900: "var(--tw-gray-900)",
          950: "var(--tw-gray-950)",
        },
        blue: {
          50: "var(--tw-blue-50)",
          100: "var(--tw-blue-100)",
          500: "var(--tw-blue-500)",
          600: "var(--tw-blue-600)",
          700: "var(--tw-blue-700)",
          800: "var(--tw-blue-800)",
        },
        lime: {
          DEFAULT: "var(--lime)",
          bright: "var(--lime-bright)",
          deep: "var(--lime-deep)",
          soft: "var(--lime-soft)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
