import type { Config } from "tailwindcss";

/**
 * Met U AI Design System
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
          mid: "#3B82F6", // Gradient mid
          soft: "#818CF8", // Accent / soft indigo
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
        canvas: {
          DEFAULT: "#E9EDF7",
          deep: "#E3E8F5",
        },
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
        glow: "0 12px 28px rgba(37, 99, 235, 0.22)",
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
        "text-wave": {
          "0%, 100%": { transform: "translateY(0)", opacity: "0.45" },
          "50%": { transform: "translateY(-4px)", opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "float-soft": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(0, -10px) scale(1.03)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.65" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s ease-in-out infinite",
        "text-wave": "text-wave 1.1s ease-in-out infinite",
        "fade-up": "fade-up 0.65s ease-out both",
        "float-soft": "float-soft 5s ease-in-out infinite",
        "glow-pulse": "glow-pulse 4s ease-in-out infinite",
        "logo-gradient": "gradient-shift 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
