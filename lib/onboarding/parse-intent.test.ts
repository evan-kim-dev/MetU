import { describe, expect, it } from "vitest";
import {
  intentPatchIsEmpty,
  mergeOnboardingIntent,
  overlayIntentPatch,
  parseOnboardingIntent,
} from "@/lib/onboarding/parse-intent";
import { INITIAL_FORM } from "@/lib/onboarding/types";

const FIXED = new Date("2026-11-20T00:00:00+09:00");

describe("parseOnboardingIntent", () => {
  it("오사카·인원·스타일을 뽑아요", () => {
    const p = parseOnboardingIntent("오사카 3박, 2인 맛집 위주로", FIXED);
    expect(p.destination).toBe("오사카");
    expect(p.origin).toBe("서울");
    expect(p.people).toBe(2);
    expect(p.styles).toContain("food");
    expect(p.dateType).toBe("flexible");
    expect(p.flexibleMonth).toBe(11);
  });

  it("도쿄와 관광·쇼핑을 뽑아요", () => {
    const p = parseOnboardingIntent("도쿄로 힐링 쇼핑 여행", FIXED);
    expect(p.destination).toBe("도쿄");
    expect(p.styles).toEqual(
      expect.arrayContaining(["healing", "shopping", "sightseeing"])
    );
  });

  it("구체 날짜 범위를 파싱해요", () => {
    const p = parseOnboardingIntent("방콕 3/1~3/5 3명", FIXED);
    expect(p.destination).toBe("방콕");
    expect(p.people).toBe(3);
    expect(p.dateType).toBe("specific");
    expect(p.startDate).toBe("2027-03-01");
    expect(p.endDate).toBe("2027-03-05");
  });

  it("월만 있으면 flexible 로 둬요", () => {
    const p = parseOnboardingIntent("제주 12월 4박 가족여행", FIXED);
    expect(p.destination).toBe("제주");
    expect(p.dateType).toBe("flexible");
    expect(p.flexibleMonth).toBe(12);
    expect(p.flexibleYear).toBe(2026);
  });

  it("빈 문장은 빈 patch 예요", () => {
    expect(intentPatchIsEmpty(parseOnboardingIntent("   "))).toBe(true);
  });
});

describe("mergeOnboardingIntent", () => {
  it("budget 은 유지하고 나머지만 덮어요", () => {
    const form: typeof INITIAL_FORM = {
      ...INITIAL_FORM,
      budget: "3000000",
      people: 2,
      styles: [],
    };
    const merged = mergeOnboardingIntent(
      form,
      parseOnboardingIntent("다낭 4인 액티비티", FIXED)
    );
    expect(merged.budget).toBe("3000000");
    expect(merged.destination).toBe("다낭");
    expect(merged.people).toBe(4);
    expect(merged.styles).toContain("activity");
    expect(merged.origin).toBe("서울");
  });
});

describe("overlayIntentPatch", () => {
  it("AI 필드가 local 을 덮어요", () => {
    const local = parseOnboardingIntent("오사카 2인", FIXED);
    const out = overlayIntentPatch(local, {
      destination: "도쿄",
      styles: ["food"],
    });
    expect(out.destination).toBe("도쿄");
    expect(out.people).toBe(2);
    expect(out.styles).toEqual(["food"]);
  });
});
