import type { Config } from "tailwindcss";

/**
 * BudgetTrip AI Design System
 * 색상/타이포/이펙트 토큰을 중앙화하여 매직 넘버 사용을 최소화한다.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563EB", // Primary
          strong: "#004AC6", // Primary text
        },
        surface: {
          base: "#F8F9FF",
          soft: "#EFF4FF",
          white: "#FFFFFF",
        },
        line: {
          soft: "#D3E4FE",
          muted: "#C3C6D7",
        },
        ink: {
          heading: "#0B1C30",
          body: "#434655",
          caption: "#737686",
        },
        success: "#006C49",
        mint: {
          DEFAULT: "#6CF8BB",
          dark: "#00714D",
        },
        danger: {
          DEFAULT: "#BA1A1A",
          border: "#FFDAD6",
        },
        insight: {
          bg: "#EFF6FF",
          border: "#DBEAFE",
        },
        membership: "#E5EEFF",
      },
      fontFamily: {
        sans: [
          "var(--font-jakarta)",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
      },
      maxWidth: {
        mobile: "440px",
      },
      boxShadow: {
        soft: "0px 4px 20px rgba(0,0,0,0.05)",
        nav: "0px -4px 20px rgba(0,0,0,0.04)",
      },
      borderRadius: {
        xl2: "20px",
      },
      keyframes: {
        "progress-fill": {
          from: { width: "0%" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
