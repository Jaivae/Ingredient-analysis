import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#102a43",
        leaf: "#2aa876",
        mint: "#e8f8f1",
        skySoft: "#e7f3ff",
        blueSoft: "#dff1ff"
      }
    }
  },
  plugins: []
};

export default config;
