export type PlaceKind =
  | "attraction"
  | "food"
  | "cafe"
  | "shopping"
  | "lodging"
  | "transport"
  | "other";

export type PlaceProviderId = "kakao" | "google";

export interface OpeningPeriod {
  /** 0 = 일요일 (Google 규칙과 동일) */
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** "HH:MM" 현지 시간 */
  open: string;
  /** "HH:MM", 자정 넘김은 "24:00" 이상 허용 (예: "26:00") */
  close: string;
}

export interface Place {
  /** places.id (uuid) — 캐시 전일 수 임시 빈 문자열 */
  id: string;
  provider: PlaceProviderId;
  /** Kakao 장소 id 또는 Google place id */
  providerPlaceId: string;
  name: string;
  /** Kakao 는 y, Google 은 location.latitude */
  lat: number;
  /** Kakao 는 x, Google 은 location.longitude */
  lng: number;
  address?: string;
  kind: PlaceKind;
  /** Google types 또는 Kakao category_name 을 ">" 로 쪼갠 조각 */
  types: string[];
  /** Kakao 는 제공하지 않음 → undefined */
  rating?: number;
  userRatingCount?: number;
  /** PRICE_LEVEL_* 원문 (Google 만) */
  priceLevel?: string;
  /** Kakao 는 undefined = 영업시간 미상 */
  openingHours?: OpeningPeriod[];
  utcOffsetMinutes?: number;
  /** Google googleMapsUri 또는 Kakao place_url */
  mapsUri?: string;
  /** Kakao 만 */
  phone?: string;
  /** Kakao category_name 원문 */
  categoryName?: string;
  /** 검색에 쓴 도시 */
  city: string;
  countryCode?: string;
  /** ISO */
  fetchedAt: string;
}

export interface PlaceSearchParams {
  city: string;
  country?: string;
  /** 예: "맛집", "카페", "대표 관광지" */
  query: string;
  kind?: PlaceKind;
  center?: { lat: number; lng: number };
  /** 기본 15000, Kakao 는 최대 20000 으로 clamp */
  radiusMeters?: number;
  /** Google 기본 20 최대 20, Kakao 기본 30 최대 45 */
  maxResults?: number;
  /** 기본 "ko" (Google 만 의미 있음) */
  languageCode?: string;
}

export interface PlaceProviderCapabilities {
  rating: boolean;
  openingHours: boolean;
  priceLevel: boolean;
}

export interface PlaceProvider {
  id: PlaceProviderId;
  capabilities: PlaceProviderCapabilities;
  /** 서버 키 존재 여부 */
  isConfigured(): boolean;
  resolveCenter(
    city: string,
    country?: string
  ): Promise<{ lat: number; lng: number } | null>;
  /** 실패 시 throw 하지 않고 [] */
  search(params: PlaceSearchParams): Promise<Place[]>;
}

/** 일정 항목에 실을 수 있는 장소 메타 (jsonb · optional · 기존 데이터 호환) */
export interface ScheduleItemPlaceFields {
  /** places.id (내부 uuid) */
  placeId?: string;
  provider?: PlaceProviderId;
  providerPlaceId?: string;
  /** false = 영업시간 미상(Kakao 장소) */
  hoursKnown?: boolean;
  /** Kakao place_url 또는 Google googleMapsUri */
  detailUrl?: string;
  lat?: number;
  lng?: number;
  /** 체류 시간(분) */
  durationMin?: number;
  kind?: PlaceKind;
  /** 체크인/체크아웃/항공편처럼 위치 고정 */
  fixed?: boolean;
  /** 이전 장소에서 이동 시간(분), UI 칩 표시용 */
  travelFromPrevMin?: number;
  /** 일정 solver 위반 코드 */
  warnings?: Array<
    "closed" | "after-day-end" | "meal-outside-window" | "fixed-missed"
  >;
}

export interface PlaceSearchResult {
  places: Place[];
  source: "cache" | "kakao" | "google" | "empty";
  provider: PlaceProviderId | null;
  capabilities: PlaceProviderCapabilities;
}
