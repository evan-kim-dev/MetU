import { describe, expect, it } from "vitest";
import { calculateSplit } from "@/lib/ledger/share-split";

describe("calculateSplit", () => {
  const members = ["a", "b", "c"];

  it("제외 없으면 1/N", () => {
    const r = calculateSplit({
      memberIds: members,
      expenses: [
        { id: "e1", paidBy: "a", krwAmount: 9000, label: "점심" },
      ],
    });
    expect(r.individualAmount).toEqual({ a: 3000, b: 3000, c: 3000 });
  });

  it("술 제외 체크 시 주류 라벨 지출에서만 빠진다", () => {
    const r = calculateSplit({
      memberIds: members,
      expenses: [
        { id: "e1", paidBy: "a", krwAmount: 9000, label: "점심" },
        { id: "e2", paidBy: "a", krwAmount: 6000, label: "맥주" },
      ],
      exclusions: { b: { alcohol: true } },
    });
    // 점심 3등분 3000, 맥주는 a·c 2등분 3000 → b=3000, a=6000, c=6000
    expect(r.individualAmount.b).toBe(3000);
    expect(r.individualAmount.a).toBe(6000);
    expect(r.individualAmount.c).toBe(6000);
  });

  it("특정 지출 id 제외", () => {
    const r = calculateSplit({
      memberIds: ["a", "b"],
      expenses: [
        { id: "e1", paidBy: "a", krwAmount: 10000, label: "택시" },
      ],
      exclusions: { b: { expenseIds: ["e1"] } },
    });
    expect(r.individualAmount).toEqual({ a: 10000, b: 0 });
  });

  it("저장된 shares 가 있고 제외 없으면 그대로 쓴다", () => {
    const r = calculateSplit({
      memberIds: ["a", "b"],
      expenses: [
        {
          id: "e1",
          paidBy: "a",
          krwAmount: 10000,
          shares: { a: 7000, b: 3000 },
        },
      ],
    });
    expect(r.individualAmount).toEqual({ a: 7000, b: 3000 });
  });
});
