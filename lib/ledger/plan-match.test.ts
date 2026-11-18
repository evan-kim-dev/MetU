import { describe, expect, it } from "vitest";

import {
  isTravelBigTicket,
  matchExpenseToPlan,
} from "@/lib/ledger/plan-match";

const alloc = [
  { id: "1", label: "숙소", amount: 400_000 },
  { id: "2", label: "항공", amount: 300_000 },
  { id: "3", label: "식비", amount: 200_000 },
];

describe("matchExpenseToPlan", () => {
  it("숙소 지출을 플랜 숙소에 맞춰요 (예상≠자동 실제)", () => {
    const m = matchExpenseToPlan({
      category: "숙소",
      label: "신주쿠 호텔",
      krwAmount: 450_000,
      allocation: alloc,
    });
    expect(m?.allocLabel).toBe("숙소");
    expect(m?.planAmountKrw).toBe(400_000);
    expect(m?.deltaKrw).toBe(50_000);
  });

  it("매칭 없으면 null", () => {
    expect(
      matchExpenseToPlan({
        category: "기타",
        label: "수수료",
        krwAmount: 1000,
        allocation: alloc,
      })
    ).toBeNull();
  });
});

describe("isTravelBigTicket", () => {
  it("항공·숙소를 골라요", () => {
    expect(isTravelBigTicket("숙소", "")).toBe(true);
    expect(isTravelBigTicket("교통", "항공권")).toBe(true);
    expect(isTravelBigTicket("식비", "라멘")).toBe(false);
  });
});
