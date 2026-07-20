import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        vector: {
          full: "#22c55e",
          partial: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
