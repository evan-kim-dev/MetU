import { describe, expect, it } from "vitest";
import {
  computeBalances,
  minimizeTransfers,
  type LedgerExpense,
} from "@/lib/ledger/settle";
import {
  buildShareText,
  shareReasonMessage,
  validateTransfersAgainstBalances,
} from "@/lib/ledger/settle-share";

const names = { a: "민수", b: "지영", c: "도현" };

describe("validateTransfersAgainstBalances", () => {
  it("accepts transfers whose sum equals positive balances", () => {
    const r = validateTransfersAgainstBalances(
      [
        { from: "b", to: "a", krw: 5000 },
        { from: "c", to: "a", krw: 3000 },
      ],
      { a: 8000, b: -5000, c: -3000 }
    );
    expect(r).toEqual({ ok: true, totalKrw: 8000 });
  });

  it("rejects when sum differs", () => {
    const r = validateTransfersAgainstBalances(
      [{ from: "b", to: "a", krw: 5000 }],
      { a: 8000, b: -5000, c: -3000 }
    );
    expect(r).toEqual({ ok: false, reason: "sum-mismatch" });
  });

  it("rejects balances that do not net to zero", () => {
    const r = validateTransfersAgainstBalances(
      [{ from: "b", to: "a", krw: 5000 }],
      { a: 5000, b: -4999 }
    );
    expect(r).toEqual({ ok: false, reason: "balances-not-zero" });
  });

  it("rejects non-integer, zero and self transfers", () => {
    const bal = { a: 100, b: -100 };
    expect(
      validateTransfersAgainstBalances([{ from: "b", to: "a", krw: 99.5 }], bal)
    ).toEqual({ ok: false, reason: "non-integer-or-non-positive" });
    expect(
      validateTransfersAgainstBalances([{ from: "b", to: "a", krw: 0 }], bal)
    ).toEqual({ ok: false, reason: "non-integer-or-non-positive" });
    expect(
      validateTransfersAgainstBalances([{ from: "a", to: "a", krw: 100 }], bal)
    ).toEqual({ ok: false, reason: "self-transfer" });
  });

  it("rejects empty transfers", () => {
    expect(validateTransfersAgainstBalances([], { a: 0 })).toEqual({
      ok: false,
      reason: "no-transfers",
    });
  });
});

describe("buildShareText", () => {
  const transfers = [
    { from: "b", to: "a", krw: 12000 },
    { from: "c", to: "a", krw: 3500, status: "paid" },
  ];
  const balances = { a: 15500, b: -12000, c: -3500 };

  it("formats amounts with formatKRW and lists every transfer", () => {
    const r = buildShareText({
      names,
      transfers,
      balances,
      shareUrl: "https://metu.app/s/tok",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toContain("• 지영 → 민수 ₩12,000");
    expect(r.text).toContain("• 도현 → 민수 ₩3,500 (송금 완료)");
    expect(r.text).toContain("총 ₩15,500");
    expect(r.text).toContain("https://metu.app/s/tok");
    expect(r.totalKrw).toBe(15500);
  });

  it("omits link line without url and warns on fx fallback", () => {
    const r = buildShareText({ names, transfers, balances, fxFallbackCount: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).not.toContain("자세히 보기");
    expect(r.text).toContain("2건");
  });

  it("does not mention fx when no fallback", () => {
    const r = buildShareText({ names, transfers, balances, fxFallbackCount: 0 });
    if (!r.ok) throw new Error("expected ok");
    expect(r.text).not.toContain("환율");
  });

  it("fails on sum mismatch instead of producing text", () => {
    const r = buildShareText({
      names,
      transfers,
      balances: { a: 20000, b: -12000, c: -8000 },
    });
    expect(r).toEqual({ ok: false, reason: "sum-mismatch" });
  });

  it("fails on unknown member", () => {
    const r = buildShareText({
      names: { a: "민수" },
      transfers: [{ from: "b", to: "a", krw: 100 }],
      balances: { a: 100, b: -100 },
    });
    expect(r).toEqual({ ok: false, reason: "unknown-member" });
  });

  it("matches output of computeBalances + minimizeTransfers (odd split)", () => {
    const expenses: LedgerExpense[] = [
      {
        id: "e1",
        paidBy: "a",
        krwAmount: 10001,
        shares: { a: 3334, b: 3334, c: 3333 },
      },
      {
        id: "e2",
        paidBy: "b",
        krwAmount: 7,
        shares: { a: 3, b: 2, c: 2 },
      },
    ];
    const bal = computeBalances(["a", "b", "c"], expenses);
    const ts = minimizeTransfers(bal);
    const r = buildShareText({ names, transfers: ts, balances: bal });
    expect(r.ok).toBe(true);
  });

  it("contains no account-number-like digit runs", () => {
    const r = buildShareText({ names, transfers, balances });
    if (!r.ok) throw new Error("expected ok");
    expect(/\d{10,}/.test(r.text)).toBe(false);
  });
});

describe("shareReasonMessage", () => {
  it("returns Korean 해요체 text", () => {
    expect(shareReasonMessage("sum-mismatch")).toMatch(/요\.$/);
    expect(shareReasonMessage("unknown-member")).toMatch(/요\.$/);
  });
});
