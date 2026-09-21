import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Industrial / SCADA-inspired palette: deep slate + amber alert accent
        base: {
          950: "#0a0e14",
          900: "#0f141c",
          800: "#171e29",
          700: "#232c3a",
        },
        alert: {
          500: "#f59e0b",
          600: "#d97706",
        },
        signal: {
          500: "#22d3ee",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
