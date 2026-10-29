import type {
  OpeningPeriod,
  Place,
  PlaceKind,
} from "@/lib/places/types";

type GoogleHourPoint = {
  day?: number;
  hour?: number;
  minute?: number;
};

type GooglePeriod = {
  open?: GoogleHourPoint;
  close?: GoogleHourPoint;
};

export type GooglePlaceRaw = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  regularOpeningHours?: { periods?: GooglePeriod[] };
  utcOffsetMinutes?: number;
  googleMapsUri?: string;
  businessStatus?: string;
};

function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function pointToHHMM(p: GoogleHourPoint | undefined): string | null {
  if (!p || typeof p.hour !== "number") return null;
  const hour = p.hour;
  const minute = typeof p.minute === "number" ? p.minute : 0;
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function mapGoogleOpeningPeriods(
  periods: GooglePeriod[] | undefined
): OpeningPeriod[] | undefined {
  if (!periods?.length) return undefined;
  const out: OpeningPeriod[] = [];
  for (const period of periods) {
    const day = period.open?.day;
    const open = pointToHHMM(period.open);
    if (typeof day !== "number" || day < 0 || day > 6 || !open) continue;
    let close = pointToHHMM(period.close);
    if (!close && period.close == null) {
      // 24시간 영업 등으로 close 가 없을 수 있음 — 미상으로 두지 않고 건너뜀
      continue;
    }
    if (!close) continue;
    // 자정 넘김: close.day 가 open.day 보다 크면 hour 에 24 가산
    if (
      typeof period.close?.day === "number" &&
      typeof period.open?.day === "number" &&
      period.close.day !== period.open.day &&
      typeof period.close.hour === "number"
    ) {
      const dayDelta =
        (period.close.day - period.open.day + 7) % 7 || 1;
      const closeHour =
        period.close.hour + 24 * dayDelta;
      const closeMin =
        typeof period.close.minute === "number" ? period.close.minute : 0;
      close = `${pad2(closeHour)}:${pad2(closeMin)}`;
    }
    out.push({
      day: day as OpeningPeriod["day"],
      open,
      close,
    });
  }
  return out.length ? out : undefined;
}

export function mapGoogleKind(
  types: string[] | undefined,
  primaryType?: string
): PlaceKind {
  const all = [
    ...(primaryType ? [primaryType] : []),
    ...(types ?? []),
  ].map((t) => t.toLowerCase());

  const has = (...keys: string[]) =>
    keys.some((k) => all.some((t) => t === k || t.includes(k)));

  if (has("lodging", "hotel", "motel", "resort")) return "lodging";
  if (has("restaurant", "meal_takeaway", "meal_delivery", "food"))
    return "food";
  if (has("cafe", "bakery", "coffee")) return "cafe";
  if (
    has(
      "tourist_attraction",
      "museum",
      "park",
      "art_gallery",
      "zoo",
      "aquarium",
      "amusement_park",
      "church",
      "hindu_temple",
      "mosque",
      "synagogue",
      "place_of_worship",
      "landmark"
    )
  ) {
    return "attraction";
  }
  if (
    has(
      "shopping_mall",
      "department_store",
      "clothing_store",
      "store",
      "supermarket",
      "market"
    )
  ) {
    return "shopping";
  }
  if (
    has(
      "transit_station",
      "subway_station",
      "train_station",
      "bus_station",
      "airport"
    )
  ) {
    return "transport";
  }
  return "other";
}

/** 순수 함수: Google Places (New) raw → Place | null */
export function mapGooglePlace(
  raw: GooglePlaceRaw,
  city: string,
  countryCode?: string
): Place | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.businessStatus && raw.businessStatus !== "OPERATIONAL") {
    return null;
  }

  const providerPlaceId = (raw.id ?? "").replace(/^places\//, "").trim();
  const name = raw.displayName?.text?.trim() ?? "";
  const lat = raw.location?.latitude;
  const lng = raw.location?.longitude;
  if (
    !providerPlaceId ||
    !name ||
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  const types = Array.isArray(raw.types) ? raw.types : [];
  const kind = mapGoogleKind(types, raw.primaryType);
  const openingHours = mapGoogleOpeningPeriods(
    raw.regularOpeningHours?.periods
  );

  const place: Place = {
    id: "",
    provider: "google",
    providerPlaceId,
    name,
    lat,
    lng,
    kind,
    types,
    city,
    fetchedAt: new Date().toISOString(),
  };

  if (raw.formattedAddress) place.address = raw.formattedAddress;
  if (typeof raw.rating === "number") place.rating = raw.rating;
  if (typeof raw.userRatingCount === "number") {
    place.userRatingCount = raw.userRatingCount;
  }
  if (raw.priceLevel) place.priceLevel = raw.priceLevel;
  if (openingHours) place.openingHours = openingHours;
  if (typeof raw.utcOffsetMinutes === "number") {
    place.utcOffsetMinutes = raw.utcOffsetMinutes;
  }
  if (raw.googleMapsUri) place.mapsUri = raw.googleMapsUri;
  if (countryCode) place.countryCode = countryCode;

  return place;
}
