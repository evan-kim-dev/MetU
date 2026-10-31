import { describe, expect, it } from "vitest";

import {
  decide,
  type PricedDraft,
  type PolicyEnv,
  type PolicySignals,
} from "@/lib/agent/policy";

const owner = "member-owner";

const baseEnv: PolicyEnv = {
  ownerMemberId: owner,
  autoMaxKrw: 300_000,
  autoDailyCap: 30,
  autoReceipt: false,
};

function draft(partial: Partial<PricedDraft> = {}): PricedDraft {
  return {
    origin: "rule",
    kind: "approval",
    confidence: 0.9,
    currency: "KRW",
    amount: 12300,
    krwAmount: 12300,
    fxResolved: true,
    fxIsFallback: false,
    payerMemberId: owner,
    unresolvedNames: [],
    warnings: [],
    spentOn: "2026-10-30",
    ...partial,
  };
}

function signals(partial: Partial<PolicySignals> = {}): PolicySignals {
  return {
    duplicateCandidates: [],
    autoCountToday: 0,
    ...partial,
  };
}

describe("decide", () => {
  it("auto_commit when all gates pass", () => {
    expect(decide(draft(), signals(), baseEnv).decision).toBe("auto_commit");
  });

  it("confidence exactly 0.85 auto", () => {
    expect(
      decide(draft({ confidence: 0.85 }), signals(), baseEnv).decision
    ).toBe("auto_commit");
  });

  it("confidence 0.849 review", () => {
    expect(
      decide(draft({ confidence: 0.849 }), signals(), baseEnv).decision
    ).toBe("review");
  });

  it("amount exactly max auto", () => {
    expect(
      decide(draft({ krwAmount: 300_000 }), signals(), baseEnv).decision
    ).toBe("auto_commit");
  });

  it("amount over max review", () => {
    expect(
      decide(draft({ krwAmount: 300_001 }), signals(), baseEnv).decision
    ).toBe("review");
  });

  it("fx fallback review for foreign", () => {
    expect(
      decide(
        draft({
          currency: "JPY",
          amount: 1000,
          krwAmount: 9000,
          fxResolved: true,
          fxIsFallback: true,
        }),
        signals(),
        baseEnv
      ).decision
    ).toBe("review");
  });

  it("duplicate score 0.59 still auto", () => {
    expect(
      decide(
        draft(),
        signals({
          duplicateCandidates: [{ expenseId: "e1", score: 0.59 }],
        }),
        baseEnv
      ).decision
    ).toBe("auto_commit");
  });

  it("duplicate score 0.6 review not ignore", () => {
    expect(
      decide(
        draft(),
        signals({
          duplicateCandidates: [{ expenseId: "e1", score: 0.6 }],
        }),
        baseEnv
      ).decision
    ).toBe("review");
  });

  it("high score dup is review (second purchase), not silent ignore", () => {
    expect(
      decide(
        draft(),
        signals({
          duplicateCandidates: [
            { expenseId: "e1", score: 1, spentOn: "2026-10-30" },
          ],
        }),
        baseEnv
      ).decision
    ).toBe("review");
  });

  it("exactResend ignore", () => {
    expect(
      decide(draft({ exactResend: true }), signals(), baseEnv).decision
    ).toBe("ignore");
  });

  it("cancel + high dup still review", () => {
    expect(
      decide(
        draft({ kind: "cancel" }),
        signals({
          duplicateCandidates: [{ expenseId: "e1", score: 0.95 }],
        }),
        baseEnv
      ).decision
    ).toBe("review");
  });

  it("warnings force review", () => {
    expect(
      decide(
        draft({ warnings: ["달러 종류 불명"] }),
        signals(),
        baseEnv
      ).decision
    ).toBe("review");
  });

  it("missing spentOn review", () => {
    expect(
      decide(draft({ spentOn: null }), signals(), baseEnv).decision
    ).toBe("review");
  });

  it("daily cap reached review", () => {
    expect(
      decide(draft(), signals({ autoCountToday: 30 }), baseEnv).decision
    ).toBe("review");
  });

  it("llm origin always review", () => {
    expect(decide(draft({ origin: "llm" }), signals(), baseEnv).decision).toBe(
      "review"
    );
  });

  it("other ignore", () => {
    expect(decide(draft({ kind: "other" }), signals(), baseEnv).decision).toBe(
      "ignore"
    );
  });

  it("receipt default review", () => {
    expect(
      decide(
        draft({ origin: "receipt", confidence: 0.95, warnings: [] }),
        signals(),
        baseEnv
      ).decision
    ).toBe("review");
  });

  it("receipt auto when flag on", () => {
    expect(
      decide(
        draft({ origin: "receipt", confidence: 0.9, warnings: [] }),
        signals(),
        { ...baseEnv, autoReceipt: true }
      ).decision
    ).toBe("auto_commit");
  });

  it("payer mismatch review", () => {
    expect(
      decide(draft({ payerMemberId: "other" }), signals(), baseEnv).decision
    ).toBe("review");
  });

  it("unresolved names review", () => {
    expect(
      decide(draft({ unresolvedNames: ["민수"] }), signals(), baseEnv).decision
    ).toBe("review");
  });
});

describe("decide — receipt merge", () => {
  const receipt = (p: Partial<PricedDraft> = {}) =>
    draft({ origin: "receipt", confidence: 0.95, ...p });
  const strong = (p: Record<string, unknown> = {}) => ({
    expenseId: "e1",
    score: 0.9,
    strong: true,
    receiptAttached: false,
    timeKnown: true,
    merchantSimilar: false,
    ...p,
  });

  it("strong 중복 + 단일 후보 + 영수증 없음 → merge (AUTO_RECEIPT 미설정이어도 새 지출 없음)", () => {
    const r = decide(
      receipt(),
      signals({ duplicateCandidates: [strong()] }),
      baseEnv
    );
    expect(r.decision).toBe("merge");
    expect(r.mergeExpenseId).toBe("e1");
  });

  it("기존 지출에 이미 영수증이 있으면 review (합치기/별개로 저장)", () => {
    const r = decide(
      receipt(),
      signals({ duplicateCandidates: [strong({ receiptAttached: true })] }),
      baseEnv
    );
    expect(r.decision).toBe("review");
    expect(r.duplicateOfExpenseId).toBe("e1");
    expect(r.reasons[0]).toContain("이미 같은 결제가 있어요");
  });

  it("시각을 모르고 상호도 다르면 review", () => {
    const r = decide(
      receipt(),
      signals({
        duplicateCandidates: [strong({ timeKnown: false, merchantSimilar: false })],
      }),
      baseEnv
    );
    expect(r.decision).toBe("review");
    expect(r.duplicateOfExpenseId).toBe("e1");
  });

  it("시각을 몰라도 상호가 비슷하면 merge", () => {
    const r = decide(
      receipt(),
      signals({
        duplicateCandidates: [strong({ timeKnown: false, merchantSimilar: true })],
      }),
      baseEnv
    );
    expect(r.decision).toBe("merge");
  });

  it("strong 후보가 여러 건이면 review (임의로 합치지 않는다)", () => {
    const r = decide(
      receipt(),
      signals({
        duplicateCandidates: [strong(), strong({ expenseId: "e2", score: 0.85 })],
      }),
      baseEnv
    );
    expect(r.decision).toBe("review");
    expect(r.mergeExpenseId).toBeUndefined();
  });

  it("strong 이 아니면(soft) 영수증은 기존처럼 review", () => {
    const r = decide(
      receipt(),
      signals({
        duplicateCandidates: [strong({ strong: false, score: 0.7 })],
      }),
      baseEnv
    );
    expect(r.decision).toBe("review");
    expect(r.mergeExpenseId).toBeUndefined();
  });

  it("카드 문자(rule)는 strong 신호가 있어도 merge 하지 않고 자동 저장도 안 한다", () => {
    const r = decide(
      draft(),
      signals({ duplicateCandidates: [strong()] }),
      baseEnv
    );
    expect(r.decision).toBe("review");
  });
});