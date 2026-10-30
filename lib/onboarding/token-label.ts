/** Base ingest-token labels used by the connect onboarding wizard. */
export const TOKEN_LABEL_IOS = "iPhone 단축어";
export const TOKEN_LABEL_ANDROID = "Android 매크로";

/**
 * Pick the next unused label for an additional device token.
 * If `base` is free, return it; otherwise `base 2`, `base 3`, …
 */
export function nextTokenLabel(
  existingLabels: readonly string[],
  base: string
): string {
  const trimmed = base.trim() || "연결 코드";
  const taken = new Set(
    existingLabels.map((l) => l.trim()).filter((l) => l.length > 0)
  );
  if (!taken.has(trimmed)) return trimmed;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${trimmed} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${trimmed} ${Date.now()}`;
}

export function defaultTokenLabelForPlatform(
  platform: "ios" | "android"
): string {
  return platform === "android" ? TOKEN_LABEL_ANDROID : TOKEN_LABEL_IOS;
}
