import { describe, expect, it } from "vitest";
import { parsePlanItinerary } from "@/lib/ai/contracts";

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
