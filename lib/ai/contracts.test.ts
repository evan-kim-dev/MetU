import { describe, expect, it } from "vitest";
import {
  parsePlanItinerary,
  parseTipsOut,
  truncateTipDescription,
} from "@/lib/ai/contracts";

const sample = {
  summary: "후쿠오카 일정 요약입니다요.",
  flight: {
    airline: "저비용",
    schedule: "가는 편 09:00 · 오는 편 18:00",
    note: "수하물 확인해요.",
  },
  hotel: {
    name: "시티 호텔",
    area: "하카타",
    note: "역세권이 편해요.",
  },
  dailySchedule: [
    {
      day: 1,
      label: "도착",
      items: [
        { time: "14:00", title: "공항 이동", detail: "지하철로 이동해요." },
      ],
    },
  ],
  tips: ["IC카드 충전해요."],
};

describe("parsePlanItinerary", () => {
  it("정상 JSON", () => {
    const parsed = parsePlanItinerary(JSON.stringify(sample));
    expect(parsed?.summary).toContain("후쿠오카");
    expect(parsed?.dailySchedule?.length).toBe(1);
  });

  it("코드펜스로 감싼 JSON", () => {
    const wrapped = "```json\n" + JSON.stringify(sample) + "\n```";
    const parsed = parsePlanItinerary(wrapped);
    expect(parsed?.flight?.airline).toBe("저비용");
  });

  it("깨진 JSON → null", () => {
    expect(parsePlanItinerary("{not-json")).toBeNull();
  });
});

describe("parseTipsOut", () => {
  it("긴 description을 짧게 잘라요", () => {
    const long =
      "여행 출발일이 코앞으로 다가왔으니 남은 항공권을 빠르게 비교하고 예약해 보세요. 인기 노선은 실시간으로 가격이 변동될 수 있어서 지금 바로 일정을 확정하는 게 가장 안전해요.";
    const parsed = parseTipsOut(
      JSON.stringify({
        tips: [{ emoji: "✈️", title: "항공", description: long }],
      })
    );
    expect(parsed?.tips[0]?.description.length).toBeLessThanOrEqual(42);
    expect(truncateTipDescription("짧은 팁이에요.")).toBe("짧은 팁이에요.");
  });
});
