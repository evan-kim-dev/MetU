import { describe, expect, it } from "vitest";
import {
  dedupeHash,
  findDuplicateCandidates,
  isReceiptStrongCandidate,
  merchantBigramSimilarity,
} from "@/lib/ledger/dedupe";

describe("dedupeHash", () => {
  it("is stable for normalized merchant", () => {
    const a = dedupeHash({
      currency: "JPY",
      amount: 4500,
      merchant: "  LAWSON  ",
      spentOn: "2026-03-01",
    });
    const b = dedupeHash({
      currency: "JPY",
      amount: 4500,
      merchant: "lawson",
      spentOn: "2026-03-01",
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("merchantBigramSimilarity", () => {
  it("scores similar merchants higher", () => {
    expect(
      merchantBigramSimilarity("LAWSON FUKUOKA", "LAWSON FUKUOKA TEN")
    ).toBeGreaterThan(0.5);
    expect(merchantBigramSimilarity("STARBUCKS", "AMAZON")).toBeLessThan(0.3);
  });
});

describe("findDuplicateCandidates", () => {
  const baseExisting = [
    {
      id: "e1",
      currency: "JPY",
      amount: 4500,
      merchant: "LAWSON FUKUOKA",
      spentOn: "2026-03-01",
      krwAmount: 40500,
      paidAt: "2026-03-01T14:00:00.000Z",
    },
    {
      id: "e2",
      currency: "USD",
      amount: 20,
      merchant: "UBER TRIP",
      spentOn: "2026-03-02",
      krwAmount: 27600,
      paidAt: "2026-03-02T09:00:00.000Z",
    },
  ];

  it("finds same-day similar merchant within KRW tolerance", () => {
    const hits = findDuplicateCandidates(
      {
        currency: "JPY",
        amount: 4600,
        merchant: "Lawson Fukuoka Ten",
        spentOn: "2026-03-01",
        krwAmount: 41400,
        paidAt: "2026-03-01T20:00:00.000Z",
      },
      baseExisting
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.expenseId).toBe("e1");
    expect(hits[0]!.score).toBeGreaterThanOrEqual(0.6);
  });

  it("returns at most 3 candidates", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      currency: "JPY",
      amount: 4500,
      merchant: "LAWSON",
      spentOn: "2026-03-01",
      krwAmount: 40500,
      paidAt: "2026-03-01T12:00:00.000Z",
    }));
    const hits = findDuplicateCandidates(
      {
        currency: "JPY",
        amount: 4500,
        merchant: "LAWSON",
        spentOn: "2026-03-01",
        krwAmount: 40500,
        paidAt: "2026-03-01T13:00:00.000Z",
      },
      many
    );
    expect(hits.length).toBeLessThanOrEqual(3);
  });

  it("cancel SMS matches same amount and merchant", () => {
    const hits = findDuplicateCandidates(
      {
        kind: "cancel",
        currency: "JPY",
        amount: 4500,
        merchant: "LAWSON FUKUOKA",
        spentOn: "2026-03-01",
      },
      baseExisting
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]!.expenseId).toBe("e1");
    expect(hits[0]!.reasons).toContain("cancel_match");
  });
});

describe("findDuplicateCandidates — receipt vs card notification", () => {
  const cardNotice = {
    id: "card1",
    currency: "JPY",
    amount: 1200,
    merchant: "LAWSON ENT",
    spentOn: "2026-10-30",
    krwAmount: 11160,
    paidAt: "2026-10-30T05:05:00.000Z",
    source: "sms",
  };
  const receipt = {
    currency: "JPY",
    amount: 1200,
    merchant: "ローソン",
    spentOn: "2026-10-30",
    paidAt: "2026-10-30T14:05:00+09:00",
    source: "receipt",
    timeIsEstimated: false,
  };

  it("상호가 달라도 같은 금액·같은 시각이면 strong 후보", () => {
    const hits = findDuplicateCandidates(receipt, [cardNotice]);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.expenseId).toBe("card1");
    expect(hits[0]!.score).toBeGreaterThanOrEqual(0.8);
    expect(hits[0]!.reasons).toContain("receipt_amount_time_match");
    expect(isReceiptStrongCandidate(hits[0]!)).toBe(true);
  });

  it("±30분 안이면 strong, 밖이면 후보 아님", () => {
    const near = findDuplicateCandidates(
      { ...receipt, paidAt: "2026-10-30T14:30:00+09:00" },
      [cardNotice]
    );
    expect(near.map((h) => h.expenseId)).toEqual(["card1"]);

    const far = findDuplicateCandidates(
      { ...receipt, paidAt: "2026-10-30T14:40:00+09:00" },
      [cardNotice]
    );
    expect(far).toHaveLength(0);
  });

  it("같은 금액이어도 다른 날이면 후보 아님", () => {
    const hits = findDuplicateCandidates(
      {
        ...receipt,
        spentOn: "2026-10-31",
        paidAt: "2026-10-31T14:05:00+09:00",
      },
      [cardNotice]
    );
    expect(hits).toHaveLength(0);
  });

  it("같은 날 같은 금액이라도 2시간 차이면 후보 아님 (두 번째 커피)", () => {
    const hits = findDuplicateCandidates(
      { ...receipt, paidAt: "2026-10-30T16:05:00+09:00" },
      [cardNotice]
    );
    expect(hits).toHaveLength(0);
  });

  it("영수증 시각이 추정이면 같은 날 기준(time_unknown)으로 strong", () => {
    const hits = findDuplicateCandidates(
      { ...receipt, paidAt: "2026-10-30T12:00:00+09:00", timeIsEstimated: true },
      [cardNotice]
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]!.reasons).toContain("time_unknown");
    expect(hits[0]!.reasons).not.toContain("within_30min");
  });

  it("상호가 비슷하면 점수가 더 높다", () => {
    const base = findDuplicateCandidates(receipt, [cardNotice])[0]!;
    const similar = findDuplicateCandidates(
      { ...receipt, merchant: "LAWSON ENT" },
      [cardNotice]
    )[0]!;
    expect(similar.score).toBeGreaterThan(base.score);
    expect(similar.reasons).toContain("merchant_similar");
  });

  it("통화나 금액이 다르면 strong 아님", () => {
    expect(
      findDuplicateCandidates({ ...receipt, amount: 1300 }, [cardNotice])
    ).toHaveLength(0);
    expect(
      findDuplicateCandidates({ ...receipt, currency: "USD" }, [cardNotice])
    ).toHaveLength(0);
  });

  it("카드알림이 영수증 뒤에 와도 같은 규칙", () => {
    const existingReceipt = {
      id: "rcpt1",
      currency: "JPY",
      amount: 1200,
      merchant: "ローソン",
      spentOn: "2026-10-30",
      krwAmount: 11160,
      paidAt: "2026-10-30T14:05:00+09:00",
      source: "receipt",
    };
    const hits = findDuplicateCandidates(
      {
        currency: "JPY",
        amount: 1200,
        merchant: "LAWSON ENT",
        spentOn: "2026-10-30",
        paidAt: "2026-10-30T05:06:00.000Z",
        source: "sms",
      },
      [existingReceipt]
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]!.reasons).toContain("receipt_amount_time_match");
  });

  it("영수증이 끼지 않은 쌍은 기존 규칙 그대로 (상호가 달라 후보 아님)", () => {
    const hits = findDuplicateCandidates(
      {
        currency: "JPY",
        amount: 1200,
        merchant: "ローソン",
        spentOn: "2026-10-30",
        paidAt: "2026-10-30T05:05:00.000Z",
        source: "sms",
      },
      [cardNotice]
    );
    expect(hits).toHaveLength(0);
  });
});