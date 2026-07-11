import type { Config } from "tailwindcss";

/**
 * Met U AI Design System (restored from cd5c457)
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
          DEFAULT: "#2563EB",
          strong: "#004AC6",
          mid: "#3B82F6",
          soft: "#818CF8",
          indigo: "#6366F1",
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
        kakao: {
          DEFAULT: "#FEE500",
          strong: "#FAE100",
          soft: "#FDE047",
          ink: "#191919",
        },
        star: "#FFB800",
        sky: {
          soft: "#70B3FF",
        },
        toggle: {
          off: "#D1D5DB",
        },
        chart: {
          track: "#E5E7EB",
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
      fontSize: {
        "3xs": ["0.5625rem", { lineHeight: "0.75rem", letterSpacing: "0.01em" }],
        "2xs": ["0.625rem", { lineHeight: "0.875rem", letterSpacing: "0.01em" }],
      },
      maxWidth: {
        mobile: "440px",
        copy: "280px",
        dialog: "300px",
        prose: "320px",
      },
      height: {
        13: "52px",
        touch: "52px",
        nav: "56px",
        select: "88px",
      },
      minHeight: {
        touch: "52px",
        tap: "44px",
        control: "40px",
      },
      width: {
        chip: "72px",
      },
      minWidth: {
        menu: "132px",
        fab: "48px",
      },
      spacing: {
        nav: "56px",
        touch: "52px",
        "nav-offset": "4.75rem",
        "safe-b": "env(safe-area-inset-bottom)",
      },
      boxShadow: {
        soft: "0px 4px 20px rgba(0,0,0,0.05)",
        nav: "0px -4px 20px rgba(0,0,0,0.04)",
        glow: "0 12px 28px rgba(37, 99, 235, 0.22)",
        kakao: "0 8px 24px rgba(254, 229, 0, 0.35)",
        "kakao-sm": "0 4px 16px rgba(254, 229, 0, 0.3)",
        overlay: "0 16px 48px rgba(0, 0, 0, 0.12)",
        "home-fab": "0 10px 24px rgba(37, 99, 235, 0.5)",
      },
      borderWidth: {
        3: "3px",
      },
      scale: {
        97: "0.97",
        98: "0.98",
        99: "0.99",
      },
      borderRadius: {
        xl2: "20px",
      },
      letterSpacing: {
        label: "0.08em",
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
        "buddy-pop": {
          "0%": { opacity: "0", transform: "translateY(48px) scale(0.6)" },
          "60%": { opacity: "1", transform: "translateY(-6px) scale(1.08)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "typing-dot": {
          "0%, 80%, 100%": {
            transform: "translateY(0) scale(0.85)",
            opacity: "0.35",
          },
          "40%": {
            transform: "translateY(-7px) scale(1.15)",
            opacity: "1",
          },
        },
        "buddy-think": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
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
        "route-draw": {
          "0%": { strokeDashoffset: "240" },
          "45%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "0" },
        },
        "globe-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "globe-spin-x": {
          "0%": { transform: "translateX(-84px)" },
          "100%": { transform: "translateX(0px)" },
        },
        "globe-route": {
          "0%": { strokeDashoffset: "120" },
          "40%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "0" },
        },
        "globe-dash": {
          "0%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "-32" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s ease-in-out infinite",
        "text-wave": "text-wave 1.1s ease-in-out infinite",
        "fade-up": "fade-up 0.65s ease-out both",
        "buddy-pop": "buddy-pop 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "typing-dot": "typing-dot 0.9s ease-in-out infinite",
        "buddy-think": "buddy-think 1.6s ease-in-out infinite",
        "float-soft": "float-soft 5s ease-in-out infinite",
        "glow-pulse": "glow-pulse 4s ease-in-out infinite",
        "logo-gradient": "gradient-shift 5s ease-in-out infinite",
        "route-draw": "route-draw 4.2s ease-in-out infinite",
        "globe-spin": "globe-spin 18s linear infinite",
        "globe-spin-x": "globe-spin-x 16s linear infinite",
        "globe-route": "globe-route 4.8s ease-in-out infinite",
        "globe-dash": "globe-dash 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
