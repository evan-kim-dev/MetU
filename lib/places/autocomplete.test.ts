import { describe, expect, it } from "vitest";
import {
  normalizeUpstreamPlaces,
  searchLocalPlaceItems,
  stripCitySuffix,
} from "@/lib/places/autocomplete";

/** 예전 fixtures/*.json 최소 샘플 (인라인 — 파일 픽스처 제거) */
const FIXTURE_JAPAN = [
  {
    type: "country",
    code: "JP",
    name: "일본",
    weight: 62801,
  },
  {
    type: "city",
    code: "TYO",
    name: "도쿄",
    country_code: "JP",
    country_name: "일본",
    weight: 67113,
  },
];

const FIXTURE_ICN = [
  {
    type: "airport",
    code: "ICN",
    name: "Seoul Incheon International",
    country_code: "KR",
    country_name: "대한민국",
    city_code: "SEL",
    city_name: "서울특별시",
    weight: 33435,
  },
];

const FIXTURE_FUKU = [
  {
    type: "city",
    code: "FUK",
    name: "후쿠오카",
    country_code: "JP",
    country_name: "일본",
    weight: 3302,
  },
  {
    type: "city",
    code: "FUJ",
    name: "후쿠에 섬",
    country_code: "JP",
    country_name: "일본",
    weight: 1,
  },
];

describe("normalizeUpstreamPlaces", () => {
  it("일본 → 첫 항목 country JP", () => {
    const items = normalizeUpstreamPlaces(FIXTURE_JAPAN, "일본", "all", 10);
    expect(items[0]).toMatchObject({ type: "country", code: "JP", name: "일본" });
  });

  it("icn all → 첫 항목 airport ICN (한글 공식명)", () => {
    const items = normalizeUpstreamPlaces(FIXTURE_ICN, "icn", "all", 10);
    expect(items[0]).toMatchObject({
      type: "airport",
      code: "ICN",
      name: "인천국제공항",
    });
  });

  it("icn cities → city SEL name 서울 matchedCode ICN", () => {
    const items = normalizeUpstreamPlaces(FIXTURE_ICN, "icn", "cities", 10);
    expect(items[0]).toMatchObject({
      type: "city",
      code: "SEL",
      name: "서울",
      matchedCode: "ICN",
    });
  });

  it("후쿠 → city FUK 후쿠오카", () => {
    const items = normalizeUpstreamPlaces(FIXTURE_FUKU, "후쿠", "all", 10);
    expect(items[0]).toMatchObject({
      type: "city",
      code: "FUK",
      name: "후쿠오카",
    });
  });

  it("cities 모드에서 같은 city 중복 제거", () => {
    const raw = [
      {
        type: "city",
        code: "TYO",
        name: "도쿄",
        country_name: "일본",
        weight: 100,
      },
      {
        type: "airport",
        code: "HND",
        name: "Haneda",
        city_code: "TYO",
        city_name: "도쿄",
        country_name: "일본",
        weight: 90,
      },
      {
        type: "airport",
        code: "NRT",
        name: "Narita",
        city_code: "TYO",
        city_name: "도쿄",
        country_name: "일본",
        weight: 80,
      },
    ];
    const items = normalizeUpstreamPlaces(raw, "도쿄", "cities", 10);
    expect(items.filter((i) => i.code === "TYO")).toHaveLength(1);
    expect(items[0]?.matchedCode).toBeUndefined();
  });

  it("3글자 코드 정확일치를 최상단으로", () => {
    const raw = [
      {
        type: "city",
        code: "OSA",
        name: "오사카",
        country_name: "일본",
        weight: 999,
      },
      {
        type: "airport",
        code: "ICN",
        name: "Seoul Incheon International",
        city_code: "SEL",
        city_name: "서울특별시",
        country_name: "대한민국",
        weight: 1,
      },
    ];
    const items = normalizeUpstreamPlaces(raw, "ICN", "all", 10);
    expect(items[0]?.code).toBe("ICN");
  });
});

describe("stripCitySuffix", () => {
  it("서울특별시 → 서울", () => {
    expect(stripCitySuffix("서울특별시")).toBe("서울");
  });
});

describe("searchLocalPlaceItems cities fallback", () => {
  it("인천 → 서울 matchedCode ICN", () => {
    const items = searchLocalPlaceItems("인천", "cities", 10);
    const seoul = items.find((i) => i.name === "서울");
    expect(seoul).toBeTruthy();
    expect(seoul?.matchedCode).toBe("ICN");
  });

  it("icn → 서울", () => {
    const items = searchLocalPlaceItems("icn", "cities", 10);
    expect(items.some((i) => i.name === "서울" && i.matchedCode === "ICN")).toBe(
      true
    );
  });
});
