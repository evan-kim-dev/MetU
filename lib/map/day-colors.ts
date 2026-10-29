/** 일차별 마커/경로 색 (Kakao·Google 공통) */
const DAY_COLORS = [
  "#E11D48", // rose
  "#2563EB", // blue
  "#059669", // emerald
  "#D97706", // amber
  "#7C3AED", // violet
  "#DB2777", // pink
  "#0D9488", // teal
  "#EA580C", // orange
] as const;

/** dayIndex: 0-based */
export function dayColor(dayIndex: number): string {
  const i = ((dayIndex % DAY_COLORS.length) + DAY_COLORS.length) % DAY_COLORS.length;
  return DAY_COLORS[i]!;
}
