import type { Config } from "tailwindcss";
import { nextui } from "@nextui-org/react";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        foreground: "#ffffff",
        primary: "#0159E0",
        border: "#333333",
        input: "#1a1a1a",
        success: {
          400: "#34d399", // emerald-400
          500: "#10b981", // emerald-500
        },
        warning: {
          800: "#854d0e", // yellow-800
          900: "#713f12", // yellow-900
        },
        danger: {
          800: "#991b1b", // red-800
          900: "#7f1d1d", // red-900
        }
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [
    nextui({
      themes: {
        dark: {
          colors: {
            background: "#000000",
            foreground: "#ffffff",
            primary: {
              DEFAULT: "#0159E0",
              foreground: "#ffffff"
            }
          }
        }
      }
    })
  ],
};

export default config; 