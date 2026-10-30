import { describe, expect, it } from "vitest";
import {
  dealIdFromName,
  normalizeDealTierLabel,
} from "@/lib/deals/data";

describe("dealIdFromName", () => {
  it("name 기반 deal- slug", () => {
    expect(dealIdFromName("다낭")).toBe("deal-다낭");
    expect(dealIdFromName("Osaka Bay")).toBe("deal-osaka-bay");
  });
});

describe("normalizeDealTierLabel", () => {
  it("영문·한글 tier → 가성비/보통/프리미엄", () => {
    expect(normalizeDealTierLabel("value")).toBe("가성비");
    expect(normalizeDealTierLabel("standard")).toBe("보통");
    expect(normalizeDealTierLabel("premium")).toBe("프리미엄");
    expect(normalizeDealTierLabel("가성비")).toBe("가성비");
    expect(normalizeDealTierLabel(undefined)).toBe("보통");
  });
});
