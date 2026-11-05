import { describe, expect, it } from "vitest";
import {
  classifyRebalanceCategory,
  rebalanceScheduleBudget,
  type RebalanceItem,
} from "@/lib/budget/rebalancer";

describe("rebalanceScheduleBudget", () => {
  it("목표 이하이면 조정 없이 안내만 해요", () => {
    const items: RebalanceItem[] = [
      { id: "1", name: "라멘", category: "meal", costKRW: 30_000 },
    ];
    const result = rebalanceScheduleBudget(items, 50_000);
    expect(result.savedAmount).toBe(0);
    expect(result.newTotal).toBe(30_000);
    expect(result.adjustmentsLog[0]).toMatch(/범위 내/);
  });

  it("15만 원 초과 시 식비 스팟을 감축해 상한에 수렴해요", () => {
    const items: RebalanceItem[] = [
      { id: "d1-meal", name: "Day 1 저녁", category: "meal", costKRW: 60_000 },
      { id: "d2-meal", name: "Day 2 식비", category: "meal", costKRW: 55_000 },
      { id: "d2-cafe", name: "Day 2 카페", category: "cafe", costKRW: 18_000 },
      {
        id: "spot",
        name: "고정 명소",
        category: "spot",
        costKRW: 40_000,
        isFixed: true,
      },
    ];
    // 합계 173_000 → 목표 150_000 (23_000 초과)
    const result = rebalanceScheduleBudget(items, 150_000);

    expect(result.originalTotal).toBe(173_000);
    expect(result.savedAmount).toBeGreaterThan(0);
    expect(result.newTotal).toBeLessThanOrEqual(150_000);
    expect(result.newTotal).toBe(result.originalTotal - result.savedAmount);

    const fixed = result.adjustedItems.find((i) => i.id === "spot");
    expect(fixed?.costKRW).toBe(40_000);

    const meals = result.adjustedItems.filter((i) => i.category === "meal");
    expect(meals.some((m) => m.costKRW < 60_000 || m.costKRW < 55_000)).toBe(
      true
    );
    expect(result.adjustmentsLog.length).toBeGreaterThan(0);
    expect(result.adjustmentsLog.some((l) => l.includes("가성비"))).toBe(true);
  });

  it("고정 항목만 있으면 감축 실패 안내를 해요", () => {
    const result = rebalanceScheduleBudget(
      [
        {
          id: "f",
          name: "고정",
          category: "meal",
          costKRW: 80_000,
          isFixed: true,
        },
      ],
      10_000
    );
    expect(result.savedAmount).toBe(0);
    expect(result.adjustmentsLog[0]).toMatch(/감축할 유동/);
  });

  it("티어 감축만으로 부족하면 비율 수렴으로 목표에 맞춰요", () => {
    const items: RebalanceItem[] = [
      { id: "a", name: "스팟A", category: "spot", costKRW: 40_000 },
      { id: "b", name: "스팟B", category: "spot", costKRW: 40_000 },
    ];
    const result = rebalanceScheduleBudget(items, 50_000);
    expect(result.newTotal).toBeLessThanOrEqual(50_000);
    expect(result.savedAmount).toBe(30_000);
    expect(result.adjustmentsLog.some((l) => l.includes("상한 맞춤"))).toBe(
      true
    );
  });
});

describe("classifyRebalanceCategory", () => {
  it("kind 와 제목으로 분류해요", () => {
    expect(classifyRebalanceCategory("food", "아무개")).toBe("meal");
    expect(classifyRebalanceCategory("cafe", "스벅")).toBe("cafe");
    expect(classifyRebalanceCategory(undefined, "오사카 라멘")).toBe("meal");
    expect(classifyRebalanceCategory(undefined, "도톤보리 투어")).toBe(
      "activity"
    );
  });
});
