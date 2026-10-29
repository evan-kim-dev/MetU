import type { MapRegion } from "@/lib/geo/region";
import { googlePlaceProvider } from "@/lib/places/google";
import { kakaoPlaceProvider } from "@/lib/places/kakao";
import type { PlaceProvider, PlaceProviderId } from "@/lib/places/types";

function overrideProvider(): PlaceProviderId | null {
  const raw = process.env.PLACE_PROVIDER_OVERRIDE?.trim().toLowerCase();
  if (raw === "kakao" || raw === "google") return raw;
  return null;
}

export function getPlaceProvider(region: MapRegion): PlaceProvider {
  const override = overrideProvider();
  if (override === "kakao") return kakaoPlaceProvider;
  if (override === "google") return googlePlaceProvider;

  if (region === "KR") {
    if (kakaoPlaceProvider.isConfigured()) return kakaoPlaceProvider;
    if (googlePlaceProvider.isConfigured()) {
      console.warn(
        "[places] KR region but KAKAO_REST_API_KEY missing; falling back to Google"
      );
      return googlePlaceProvider;
    }
    return kakaoPlaceProvider;
  }

  // GLOBAL: Google only — do not fall back to Kakao
  return googlePlaceProvider;
}
