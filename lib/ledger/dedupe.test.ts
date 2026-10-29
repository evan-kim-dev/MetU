import { describe, expect, it } from "vitest";
import {
  dedupeHash,
  findDuplicateCandidates,
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
