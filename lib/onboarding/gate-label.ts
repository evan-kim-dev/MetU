/**
 * Safe Korean label for post-onboarding return path.
 * Never echoes raw path to the user; rejects external / protocol-relative URLs.
 */
export function gateLabel(path: string): string | null {
  const raw = path.trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return null;

  const noQuery = raw.split("?")[0]?.split("#")[0] ?? raw;
  if (noQuery === "/") return "홈";
  if (noQuery === "/trips") return "내 여행";
  if (noQuery === "/trips/new") return "여행 만들기";
  if (noQuery === "/agent") return "자동 기록";
  if (/^\/trips\/[^/]+\/ledger\/?$/.test(noQuery)) return "가계부";
  return "원래 보려던 화면";
}
