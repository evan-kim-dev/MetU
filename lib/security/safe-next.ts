/** Open-redirect 방지: 내부 상대 경로만 허용 */
export function safeNextPath(
  raw: string | null | undefined,
  fallback = "/"
): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("://")) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}
