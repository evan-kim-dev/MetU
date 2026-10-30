import { beforeEach, describe, expect, it, vi } from "vitest";

const aiChatOrNull = vi.fn();
const upsert = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select, upsert }));

vi.mock("@/lib/ai/chat-client", () => ({
  aiChatOrNull: (...args: unknown[]) => aiChatOrNull(...args),
}));

vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({ from }),
}));

function sampleAiJson(count = 6) {
  const cities = [
    ["다낭", "베트남", "가성비"],
    ["방콕", "태국", "가성비"],
    ["오사카", "일본", "보통"],
    ["타이베이", "대만", "보통"],
    ["후쿠오카", "일본", "프리미엄"],
    ["세부", "필리핀", "가성비"],
    ["발리", "인도네시아", "보통"],
  ];
  return {
    deals: cities.slice(0, count).map(([name, country, tier]) => ({
      name,
      country,
      bestMonth: "4~5월",
      highlight: `${name}은 이번 달 시즌에 잘 맞는 추천이에요`,
      tier,
    })),
  };
}

describe("curateRecommendedDeals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: null });
    aiChatOrNull.mockReset();
  });

  it("정상 JSON → 6개·가격 필드 없음", async () => {
    aiChatOrNull.mockResolvedValue({
      content: JSON.stringify(sampleAiJson(6)),
      source: "ai",
      validated: true,
      cached: false,
    });

    const { curateRecommendedDeals } = await import(
      "@/lib/deals/recommend-deals"
    );
    const res = await curateRecommendedDeals();

    expect(res.places).toHaveLength(6);
    expect(res.source).toBe("ai+rag");
    for (const place of res.places) {
      expect(place).not.toHaveProperty("fromPrice");
      expect(place).not.toHaveProperty("flightFrom");
      expect(place).not.toHaveProperty("hotelFrom");
      expect(place.id).toMatch(/^deal-/);
      expect(["가성비", "보통", "프리미엄"]).toContain(place.budgetLabel);
    }
    expect(aiChatOrNull).toHaveBeenCalledTimes(1);
  });

  it("깨진 JSON → 빈 상태", async () => {
    aiChatOrNull.mockResolvedValue({
      content: "{not-json",
      source: "ai",
      validated: true,
      cached: false,
    });

    const { curateRecommendedDeals } = await import(
      "@/lib/deals/recommend-deals"
    );
    const res = await curateRecommendedDeals();
    expect(res.places).toEqual([]);
    expect(res.source).toBe("empty");
  });

  it("캐시 히트 시 aiChatOrNull 호출 0회", async () => {
    const cachedPlaces = sampleAiJson(6).deals.map((d, i) => ({
      id: `deal-cached-${i}`,
      name: d.name,
      country: d.country,
      budgetLabel: "가성비",
      bestMonth: d.bestMonth,
      highlight: d.highlight,
      imageUrl: "https://example.com/x.jpg",
    }));

    maybeSingle.mockResolvedValue({
      data: {
        key: "deals:v1:test",
        value: { places: cachedPlaces },
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    const { curateRecommendedDeals } = await import(
      "@/lib/deals/recommend-deals"
    );
    const res = await curateRecommendedDeals();

    expect(res.places).toHaveLength(6);
    expect(res.source).toBe("cache");
    expect(res.hit).toBe("fresh");
    expect(aiChatOrNull).toHaveBeenCalledTimes(0);
  });

  it("Gemini null + 캐시 없음 → 빈 상태", async () => {
    aiChatOrNull.mockResolvedValue(null);
    const { curateRecommendedDeals } = await import(
      "@/lib/deals/recommend-deals"
    );
    const res = await curateRecommendedDeals();
    expect(res.places).toEqual([]);
    expect(res.source).toBe("empty");
  });
});

describe("parseDealsOut (생성 스키마)", () => {
  it("name/country/tier 스키마를 파싱한다", async () => {
    const { parseDealsOut } = await import("@/lib/ai/contracts");
    const parsed = parseDealsOut(JSON.stringify(sampleAiJson(3)));
    expect(parsed?.deals).toHaveLength(3);
    expect(parsed?.deals[0]).toMatchObject({
      name: "다낭",
      country: "베트남",
      tier: "가성비",
    });
    expect(parsed?.deals[0]).not.toHaveProperty("id");
  });

  it("가격 필드가 있어도 무시하고 name 기반만 남긴다", async () => {
    const { parseDealsOut } = await import("@/lib/ai/contracts");
    const parsed = parseDealsOut(
      JSON.stringify({
        deals: [
          {
            name: "오사카",
            country: "일본",
            bestMonth: "3월",
            highlight: "봄 시즌 추천이에요",
            tier: "보통",
            fromPrice: 720000,
            flightFrom: 268000,
          },
        ],
      })
    );
    expect(parsed?.deals).toHaveLength(1);
    expect(parsed?.deals[0]).not.toHaveProperty("fromPrice");
  });
});
