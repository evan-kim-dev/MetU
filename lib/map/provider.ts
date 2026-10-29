import type { MapRegion } from "@/lib/geo/region";

export type BrowserMapProvider = "kakao" | "google";

/**
 * 브라우저 지도 공급자 선택.
 * KR → Kakao(키 있으면), 없으면 Google 폴백(경고).
 * GLOBAL → Google only.
 */
export function mapProviderFor(
  region: MapRegion,
  keys: { kakao: boolean; google: boolean }
): BrowserMapProvider | null {
  if (region === "KR") {
    if (keys.kakao) return "kakao";
    if (keys.google) {
      console.warn(
        "[map] KR region but NEXT_PUBLIC_KAKAO_JS_KEY missing; falling back to Google map"
      );
      return "google";
    }
    return null;
  }
  if (keys.google) return "google";
  return null;
}

export function hasBrowserMapKeys(): { kakao: boolean; google: boolean } {
  return {
    kakao: Boolean(process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim()),
    google: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim()),
  };
}
