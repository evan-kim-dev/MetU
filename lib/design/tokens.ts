/**
 * MetU design tokens (UX-S0).
 * Single source for mu-* colors, radii, and motion.
 * CSS variables in globals.css and Tailwind `mu` keys must stay in sync
 * (asserted by tokens.test.ts).
 */

export const MU_COLORS = {
  bg: "#F7F8FA",
  card: "#FFFFFF",
  sunken: "#F2F4F6",
  line: "#E5E8EB",
  lineStrong: "#8B95A1",
  fg: "#191F28",
  fg2: "#4E5968",
  fg3: "#5F6B7A",
  accent: "#2563EB",
  accentStrong: "#1D4ED8",
  accentSoft: "#EFF4FF",
  onAccent: "#FFFFFF",
  ok: "#0B7A4B",
  okSoft: "#E8F7F0",
  warn: "#8A5A00",
  warnSoft: "#FFF4DB",
  err: "#C62828",
  errSoft: "#FDECEC",
  disabledFg: "#8B95A1",
  disabledBg: "#F2F4F6",
} as const;

export type MuColorKey = keyof typeof MU_COLORS;

export const MU_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

export const MU_MOTION = {
  fastMs: 150,
  baseMs: 200,
  slowMs: 250,
  ease: "cubic-bezier(0.2,0,0,1)",
} as const;

/** CSS custom property names matching MU_COLORS / motion. */
export const MU_CSS_VARS: Record<string, string> = {
  "--mu-bg": MU_COLORS.bg,
  "--mu-card": MU_COLORS.card,
  "--mu-sunken": MU_COLORS.sunken,
  "--mu-line": MU_COLORS.line,
  "--mu-line-strong": MU_COLORS.lineStrong,
  "--mu-fg": MU_COLORS.fg,
  "--mu-fg-2": MU_COLORS.fg2,
  "--mu-fg-3": MU_COLORS.fg3,
  "--mu-accent": MU_COLORS.accent,
  "--mu-accent-strong": MU_COLORS.accentStrong,
  "--mu-accent-soft": MU_COLORS.accentSoft,
  "--mu-on-accent": MU_COLORS.onAccent,
  "--mu-ok": MU_COLORS.ok,
  "--mu-ok-soft": MU_COLORS.okSoft,
  "--mu-warn": MU_COLORS.warn,
  "--mu-warn-soft": MU_COLORS.warnSoft,
  "--mu-err": MU_COLORS.err,
  "--mu-err-soft": MU_COLORS.errSoft,
  "--mu-disabled-fg": MU_COLORS.disabledFg,
  "--mu-disabled-bg": MU_COLORS.disabledBg,
  "--mu-dur-fast": `${MU_MOTION.fastMs}ms`,
  "--mu-dur": `${MU_MOTION.baseMs}ms`,
  "--mu-dur-slow": `${MU_MOTION.slowMs}ms`,
  "--mu-ease": MU_MOTION.ease,
};

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (WCAG). */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (full.length !== 6) {
    throw new Error(`bad-hex:${hex}`);
  }
  const r = channelToLinear(parseInt(full.slice(0, 2), 16));
  const g = channelToLinear(parseInt(full.slice(2, 4), 16));
  const b = channelToLinear(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two hex colors (WCAG). */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
