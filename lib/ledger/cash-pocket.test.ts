import { describe, expect, it } from "vitest";

import { computeCashPocket, isCashInflow } from "@/lib/ledger/cash-pocket";

describe("isCashInflow", () => {
  it("인출·ATM 라벨을 유입으로 봐요", () => {
    expect(isCashInflow({ label: "편의점 ATM 인출", merchant: "" })).toBe(true);
    expect(isCashInflow({ label: "환전", merchant: "KEB" })).toBe(true);
    expect(isCashInflow({ label: "라멘", merchant: "이치란" })).toBe(false);
  });
});

describe("computeCashPocket", () => {
  it("인출 후 현금 지출을 빼요", () => {
    const pocket = computeCashPocket([
      {
        id: "1",
        label: "ATM 인출",
        merchant: "",
        amount: 10000,
        currency: "JPY",
        krwAmount: 90000,
        paymentMethod: "cash",
      },
      {
        id: "2",
        label: "라멘",
        merchant: "이치란",
        amount: 1200,
        currency: "JPY",
        krwAmount: 10800,
        paymentMethod: "cash",
      },
      {
        id: "3",
        label: "카드 결제",
        merchant: "편의점",
        amount: 500,
        currency: "JPY",
        krwAmount: 4500,
        paymentMethod: "card",
      },
    ]);
    expect(pocket.byCurrency.JPY).toBe(8800);
    expect(pocket.krwBalance).toBe(79200);
    expect(pocket.inflowCount).toBe(1);
    expect(pocket.outflowCount).toBe(1);
  });
});
