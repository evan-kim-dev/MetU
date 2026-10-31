/**
 * Part A gate record: hardcoded CITY_POI_DAYS vs dynamic (mocked attractions).
 * Templates were removed after this comparison passed (2026-10-31).
 *
 * Frozen baseline (nights=3):
 * 싱가포르: days 4→4, items 19→18, named 16→12
 * 오사카: days 4→4, items 16→18, named 10→12
 * 도쿄: days 4→4, items 17→18, named 10→12
 * 방콕: days 4→4, items 16→18, named 8→12
 * 다낭: days 4→4, items 16→18, named 5→12
 * 서울: days 4→4, items 17→18, named 6→12
 * 부산: days 4→4, items 17→18, named 4→12
 * 제주: days 4→4, items 17→18, named 7→12
 * 강릉: days 4→4, items 16→18, named 4→12
 * 전주: days 4→4, items 17→18, named 4→12
 */
import { describe, expect, it } from "vitest";
import type { DestinationAttraction } from "@/lib/ai/destination-knowledge";
import { buildDynamicPoiSchedule } from "@/lib/ai/destination-knowledge";
import {
  buildMinimalLodgingTransportSchedule,
  isMinimalScheduleFallback,
  SCHEDULE_RETRY_TIP,
} from "@/lib/ai/destination-pois";

const CITIES = [
  "싱가포르",
  "오사카",
  "도쿄",
  "방콕",
  "다낭",
  "서울",
  "부산",
  "제주",
  "강릉",
  "전주",
] as const;

const BUDGETS = { food: 30_000, activity: 40_000, transport: 15_000 };
const NIGHTS = 3;
const STYLES = ["hotplace" as const, "food" as const];
const ORIGIN = "인천";

const MOCK_ATTRACTIONS: Record<(typeof CITIES)[number], DestinationAttraction[]> = {
  싱가포르: [
    { name: "Gardens by the Bay", detail: "슈퍼트리와 플라워돔" },
    { name: "Merlion Park", detail: "마리나 베이 상징" },
    { name: "Chinatown", detail: "사찰과 먹거리" },
    { name: "Sentosa Island", detail: "해변과 테마파크" },
    { name: "Orchard Road", detail: "쇼핑 거리" },
    { name: "Singapore Botanic Gardens", detail: "유네스코 식물원" },
  ],
  오사카: [
    { name: "Osaka Castle", detail: "오사카성" },
    { name: "Dotonbori", detail: "도톤보리 네온" },
    { name: "Umeda Sky Building", detail: "공중정원" },
    { name: "Shinsekai", detail: "츠텐카쿠" },
    { name: "Shinsaibashi", detail: "쇼핑 아케이드" },
    { name: "Kuromon Market", detail: "시장 먹거리" },
  ],
  도쿄: [
    { name: "Senso-ji", detail: "아사쿠사 센소지" },
    { name: "Shibuya Crossing", detail: "스크램블 교차로" },
    { name: "Tokyo Skytree", detail: "스카이트리" },
    { name: "Meiji Shrine", detail: "메이지신궁" },
    { name: "Akihabara", detail: "전자·애니메 거리" },
    { name: "teamLab Planets", detail: "디지털 아트" },
  ],
  방콕: [
    { name: "Grand Palace", detail: "왕궁" },
    { name: "Wat Arun", detail: "새벽사원" },
    { name: "Chatuchak Market", detail: "주말 시장" },
    { name: "Khao San Road", detail: "배낭거리" },
    { name: "ICONSIAM", detail: "쇼핑몰" },
    { name: "Jim Thompson House", detail: "실크 박물관" },
  ],
  다낭: [
    { name: "My Khe Beach", detail: "미케 해변" },
    { name: "Dragon Bridge", detail: "용다리" },
    { name: "Marble Mountains", detail: "오행산" },
    { name: "Han Market", detail: "한시장" },
    { name: "Son Tra Peninsula", detail: "선짜 반도" },
    { name: "Ba Na Hills", detail: "바나힐" },
  ],
  서울: [
    { name: "Gyeongbokgung", detail: "경복궁" },
    { name: "Bukchon Hanok Village", detail: "북촌" },
    { name: "Hongdae", detail: "홍대" },
    { name: "N Seoul Tower", detail: "N서울타워" },
    { name: "Dongdaemun Design Plaza", detail: "DDP" },
    { name: "Hangang Park", detail: "한강공원" },
  ],
  부산: [
    { name: "Haeundae Beach", detail: "해운대" },
    { name: "Gamcheon Culture Village", detail: "감천문화마을" },
    { name: "Jagalchi Market", detail: "자갈치" },
    { name: "Gwangalli Beach", detail: "광안리" },
    { name: "Taejongdae", detail: "태종대" },
    { name: "BIFF Square", detail: "영화의전당 일대" },
  ],
  제주: [
    { name: "Seongsan Ilchulbong", detail: "성산일출봉" },
    { name: "Hallasan", detail: "한라산" },
    { name: "Cheonjeyeon Waterfall", detail: "천제연폭포" },
    { name: "Dongmun Market", detail: "동문시장" },
    { name: "Udo", detail: "우도" },
    { name: "Jeju Folk Village", detail: "민속촌" },
  ],
  강릉: [
    { name: "Gyeongpo Beach", detail: "경포해변" },
    { name: "Ojukheon", detail: "오죽헌" },
    { name: "Anmok Beach", detail: "안목커피거리" },
    { name: "Jeongdongjin", detail: "정동진" },
    { name: "Gangneung Coffee Street", detail: "커피거리" },
    { name: "Chamsori Museum", detail: "참소리축음기" },
  ],
  전주: [
    { name: "Jeonju Hanok Village", detail: "한옥마을" },
    { name: "Gyeonggijeon", detail: "경기전" },
    { name: "Nambu Market", detail: "남부시장" },
    { name: "Omokdae", detail: "오목대" },
    { name: "Deokjin Park", detail: "덕진공원" },
    { name: "Jeondong Cathedral", detail: "전동성당" },
  ],
};

describe("destination POI dynamic fallback", () => {
  for (const city of CITIES) {
    it(`${city}: dynamic schedule keeps day count and named POIs`, () => {
      const dynamic = buildDynamicPoiSchedule(
        city,
        ORIGIN,
        NIGHTS,
        STYLES,
        BUDGETS,
        MOCK_ATTRACTIONS[city]
      );
      expect(dynamic).not.toBeNull();
      expect(dynamic!.length).toBe(NIGHTS + 1);
      const titles = dynamic!.flatMap((d) => d.items.map((i) => i.title));
      const named = MOCK_ATTRACTIONS[city].filter((a) =>
        titles.some((t) => t.includes(a.name.split(" ")[0]!))
      );
      expect(named.length).toBeGreaterThanOrEqual(3);
      expect(isMinimalScheduleFallback(dynamic!)).toBe(false);
    });
  }

  it("empty attractions → minimal lodging/transport + retry tip constant", () => {
    expect(buildDynamicPoiSchedule("파리", ORIGIN, NIGHTS, STYLES, BUDGETS, [])).toBeNull();
    const minimal = buildMinimalLodgingTransportSchedule(
      "파리",
      ORIGIN,
      NIGHTS,
      BUDGETS
    );
    expect(isMinimalScheduleFallback(minimal)).toBe(true);
    expect(minimal[0]?.label).toContain("숙소 · 교통");
    expect(SCHEDULE_RETRY_TIP).toMatch(/다시 시도/);
  });
});
