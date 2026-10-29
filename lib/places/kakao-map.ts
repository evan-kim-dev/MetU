import type { Place, PlaceKind } from "@/lib/places/types";

export type KakaoDocument = {
  id?: string;
  place_name?: string;
  category_name?: string;
  category_group_code?: string;
  phone?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
  place_url?: string;
};

const GROUP_TO_KIND: Record<string, PlaceKind> = {
  FD6: "food",
  CE7: "cafe",
  AT4: "attraction",
  CT1: "attraction",
  AD5: "lodging",
  SW8: "transport",
  MT1: "shopping",
  CS2: "shopping",
};

export function mapKakaoKind(
  categoryGroupCode: string | undefined,
  categoryName: string | undefined
): PlaceKind {
  const code = (categoryGroupCode ?? "").trim().toUpperCase();
  if (code && GROUP_TO_KIND[code]) return GROUP_TO_KIND[code];
  if (categoryName?.includes("쇼핑")) return "shopping";
  return "other";
}

/** 순수 함수: Kakao Local document → Place | null */
export function mapKakaoDocument(
  doc: KakaoDocument,
  city: string
): Place | null {
  if (!doc || typeof doc !== "object") return null;
  const providerPlaceId = String(doc.id ?? "").trim();
  const name = (doc.place_name ?? "").trim();
  const lat = Number(doc.y);
  const lng = Number(doc.x);
  if (
    !providerPlaceId ||
    !name ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  const categoryName = doc.category_name?.trim();
  const types = categoryName
    ? categoryName.split(">").map((s) => s.trim()).filter(Boolean)
    : [];
  const kind = mapKakaoKind(doc.category_group_code, categoryName);
  const address =
    (doc.road_address_name || doc.address_name || "").trim() || undefined;

  const place: Place = {
    id: "",
    provider: "kakao",
    providerPlaceId,
    name,
    lat,
    lng,
    kind,
    types,
    city,
    fetchedAt: new Date().toISOString(),
  };

  if (address) place.address = address;
  if (doc.place_url) place.mapsUri = doc.place_url;
  if (doc.phone) place.phone = doc.phone;
  if (categoryName) place.categoryName = categoryName;
  // rating / userRatingCount / priceLevel / openingHours 는 절대 채우지 않음

  return place;
}

export function kindToKakaoCategory(kind?: PlaceKind): string | undefined {
  switch (kind) {
    case "food":
      return "FD6";
    case "cafe":
      return "CE7";
    case "attraction":
      return "AT4";
    case "lodging":
      return "AD5";
    default:
      return undefined;
  }
}
