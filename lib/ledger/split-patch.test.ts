import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  SplitPatchSchema,
  applySplitPatch,
  currentParticipants,
  sharesDigest,
  splitPatchReasonMessage,
  type SplitPatch,
  type SplitPatchExpense,
} from "@/lib/ledger/split-patch";

const EXP = "22222222-2222-4222-8222-222222222222";
const A = "member-a";
const B = "member-b";
const C = "member-c";
const MEMBERS = [A, B, C];

function patch(over: Partial<SplitPatch> = {}): SplitPatch {
  return {
    expenseId: EXP,
    exclude: [],
    only: [],
    weights: [],
    itemExclusions: [],
    clarification: null,
    ...over,
  };
}

function expense(over: Partial<SplitPatchExpense> = {}): SplitPatchExpense {
  return {
    id: EXP,
    krwAmount: 30000,
    shares: { [A]: 10000, [B]: 10000, [C]: 10000 },
    items: [],
    ...over,
  };
}

function sum(shares: Record<string, number>): number {
  return Object.values(shares).reduce((s, v) => s + v, 0);
}

describe("SplitPatchSchema", () => {
  it("정확히 하나만 채워진 patch 는 통과한다", () => {
    expect(SplitPatchSchema.safeParse(patch({ exclude: [A] })).success).toBe(true);
    expect(SplitPatchSchema.safeParse(patch({ only: [A, B] })).success).toBe(true);
    expect(
      SplitPatchSchema.safeParse(patch({ weights: [{ memberId: A, weight: 2 }] }))
        .success
    ).toBe(true);
    expect(
      SplitPatchSchema.safeParse(
        patch({ itemExclusions: [{ memberId: A, itemIndex: 0 }] })
      ).success
    ).toBe(true);
  });

  it("두 개 이상 채우면 실패한다", () => {
    expect(
      SplitPatchSchema.safeParse(patch({ exclude: [A], only: [B] })).success
    ).toBe(false);
  });

  it("전부 비었으면 실패하지만 clarification 만 있으면 통과한다", () => {
    expect(SplitPatchSchema.safeParse(patch()).success).toBe(false);
    expect(
      SplitPatchSchema.safeParse(patch({ clarification: "누구를 빼요?" })).success
    ).toBe(true);
  });

  it("clarification 과 다른 필드를 같이 채워도 한 가지만 허용한다", () => {
    expect(
      SplitPatchSchema.safeParse(patch({ exclude: [A], clarification: "확인" }))
        .success
    ).toBe(true);
    expect(
      SplitPatchSchema.safeParse(
        patch({ exclude: [A], only: [B], clarification: "확인" })
      ).success
    ).toBe(false);
  });

  it("amount / krw / shares 같은 알 수 없는 키는 거절한다 (strict)", () => {
    for (const extra of [
      { amount: 5000 },
      { krw: 5000 },
      { krwAmount: 5000 },
      { shares: { [A]: 1000 } },
    ]) {
      expect(
        SplitPatchSchema.safeParse({ ...patch({ exclude: [A] }), ...extra })
          .success
      ).toBe(false);
    }
    expect(
      SplitPatchSchema.safeParse(
        patch({
          weights: [{ memberId: A, weight: 2, krw: 1000 } as never],
        })
      ).success
    ).toBe(false);
    expect(
      SplitPatchSchema.safeParse(
        patch({
          itemExclusions: [{ memberId: A, itemIndex: 0, amount: 10 } as never],
        })
      ).success
    ).toBe(false);
  });

  it("JSON 스키마 어디에도 금액 계열 키가 없다", () => {
    const json = JSON.stringify(z.toJSONSchema(SplitPatchSchema));
    expect(json).not.toMatch(/amount|krw|price|share/i);
  });

  it("weight 는 양수만, itemIndex 는 정수만", () => {
    expect(
      SplitPatchSchema.safeParse(patch({ weights: [{ memberId: A, weight: 0 }] }))
        .success
    ).toBe(false);
    expect(
      SplitPatchSchema.safeParse(
        patch({ itemExclusions: [{ memberId: A, itemIndex: 1.5 }] })
      ).success
    ).toBe(false);
    expect(
      SplitPatchSchema.safeParse(patch({ exclude: [A], expenseId: "nope" }))
        .success
    ).toBe(false);
  });
});

describe("applySplitPatch — exclude / only", () => {
  it("exclude: 한 명을 빼면 남은 사람끼리 균등, 합은 총액", () => {
    const r = applySplitPatch({
      patch: patch({ exclude: [C] }),
      expense: expense(),
      memberIds: MEMBERS,
    });
    expect(r).toMatchObject({ ok: true, kind: "exclude", splitType: "equal" });
    if (!r.ok) return;
    expect(r.shares).toEqual({ [A]: 15000, [B]: 15000 });
    expect(sum(r.shares)).toBe(30000);
    expect(r.inputValues).toEqual({});
  });

  it("exclude: 나누어떨어지지 않아도 1원도 새지 않는다", () => {
    const r = applySplitPatch({
      patch: patch({ exclude: [C] }),
      expense: expense({ krwAmount: 10001, shares: { [A]: 3334, [B]: 3333, [C]: 3334 } }),
      memberIds: MEMBERS,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(sum(r.shares)).toBe(10001);
  });

  it("exclude: 이미 빠져 있던 사람은 현재 참여자 기준으로 계산한다", () => {
    const r = applySplitPatch({
      patch: patch({ exclude: [B] }),
      expense: expense({ krwAmount: 9000, shares: { [A]: 3000, [B]: 3000, [C]: 3000 } }),
      memberIds: MEMBERS,
    });
    expect(r.ok && r.shares).toEqual({ [A]: 4500, [C]: 4500 });
  });

  it("exclude: 모두 빼면 실패", () => {
    const r = applySplitPatch({
      patch: patch({ exclude: [A, B, C] }),
      expense: expense(),
      memberIds: MEMBERS,
    });
    expect(r).toEqual({ ok: false, reason: "nobody-left" });
  });

  it("only: 지목한 사람끼리만 균등", () => {
    const r = applySplitPatch({
      patch: patch({ only: [A, B] }),
      expense: expense(),
      memberIds: MEMBERS,
    });
    expect(r.ok && r.shares).toEqual({ [A]: 15000, [B]: 15000 });
  });

  it("only: 중복 지목은 한 번으로 센다", () => {
    const r = applySplitPatch({
      patch: patch({ only: [A, A] }),
      expense: expense(),
      memberIds: MEMBERS,
    });
    expect(r.ok && r.shares).toEqual({ [A]: 30000 });
  });

  it("멤버가 아닌 id 는 실패", () => {
    for (const p of [
      patch({ exclude: ["ghost"] }),
      patch({ only: ["ghost"] }),
      patch({ weights: [{ memberId: "ghost", weight: 2 }] }),
      patch({ itemExclusions: [{ memberId: "ghost", itemIndex: 0 }] }),
    ]) {
      expect(
        applySplitPatch({
          patch: p,
          expense: expense({ items: [{ amount: 1000 }] }),
          memberIds: MEMBERS,
        })
      ).toEqual({ ok: false, reason: "unknown-member" });
    }
  });

  it("결과가 현재와 같으면 no-change", () => {
    const r = applySplitPatch({
      patch: patch({ only: [A, B, C] }),
      expense: expense(),
      memberIds: MEMBERS,
    });
    expect(r).toEqual({ ok: false, reason: "no-change" });
  });
});

describe("applySplitPatch — weights", () => {
  it("A 를 두 배로: 말하지 않은 사람은 비율 1", () => {
    const r = applySplitPatch({
      patch: patch({ weights: [{ memberId: A, weight: 2 }] }),
      expense: expense({ krwAmount: 40000 }),
      memberIds: MEMBERS,
    });
    expect(r).toMatchObject({ ok: true, splitType: "ratio" });
    if (!r.ok) return;
    expect(r.shares).toEqual({ [A]: 20000, [B]: 10000, [C]: 10000 });
    expect(r.inputValues).toEqual({ [A]: 2, [B]: 1, [C]: 1 });
  });

  it("비율이 나누어떨어지지 않아도 합이 총액과 같다", () => {
    const r = applySplitPatch({
      patch: patch({
        weights: [
          { memberId: A, weight: 1 },
          { memberId: B, weight: 1 },
          { memberId: C, weight: 1 },
        ],
      }),
      expense: expense({ krwAmount: 10000, shares: { [A]: 5000, [B]: 5000 } }),
      memberIds: MEMBERS,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(sum(r.shares)).toBe(10000);
      expect(Object.keys(r.shares).sort()).toEqual([A, B, C]);
    }
  });

  it("같은 멤버가 두 번이면 실패", () => {
    const r = applySplitPatch({
      patch: patch({
        weights: [
          { memberId: A, weight: 1 },
          { memberId: A, weight: 2 },
        ],
      }),
      expense: expense(),
      memberIds: MEMBERS,
    });
    expect(r).toEqual({ ok: false, reason: "duplicate-member" });
  });
});

describe("applySplitPatch — itemExclusions", () => {
  const items = [{ amount: 20000 }, { amount: 10000 }];

  it("품목에서 한 명을 빼면 그 품목만 나머지끼리 나눈다", () => {
    // 총 30000: 품목0 20000, 품목1 10000. C 가 품목0 에서 빠짐.
    const r = applySplitPatch({
      patch: patch({ itemExclusions: [{ memberId: C, itemIndex: 0 }] }),
      expense: expense({ items }),
      memberIds: MEMBERS,
    });
    expect(r).toMatchObject({ ok: true, splitType: "fixed" });
    if (!r.ok) return;
    // 품목0: A 10000, B 10000 / 품목1: 3334, 3333, 3333 (사전순 첫 사람이 1원 더)
    expect(r.shares[C]).toBe(3333);
    expect(r.shares[A]! + r.shares[B]!).toBe(30000 - 3333);
    expect(sum(r.shares)).toBe(30000);
  });

  it("세금·봉사료가 있어 품목 합과 총액이 달라도 총액을 비율로 나눈다", () => {
    // 품목 합 30000, 총액 33000(10% 봉사료). 품목0 22000, 품목1 11000.
    const r = applySplitPatch({
      patch: patch({ itemExclusions: [{ memberId: A, itemIndex: 0 }] }),
      expense: expense({ krwAmount: 33000, items, shares: { [A]: 11000, [B]: 11000, [C]: 11000 } }),
      memberIds: MEMBERS,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(sum(r.shares)).toBe(33000);
    // A 는 품목0 에서 빠졌으므로 품목1 의 1/3 (3667 이하)만 낸다.
    expect(r.shares[A]).toBeLessThanOrEqual(3667);
  });

  it("품목이 없으면 실패", () => {
    expect(
      applySplitPatch({
        patch: patch({ itemExclusions: [{ memberId: A, itemIndex: 0 }] }),
        expense: expense({ items: [] }),
        memberIds: MEMBERS,
      })
    ).toEqual({ ok: false, reason: "no-items" });
  });

  it("범위 밖 품목은 실패", () => {
    expect(
      applySplitPatch({
        patch: patch({ itemExclusions: [{ memberId: A, itemIndex: 5 }] }),
        expense: expense({ items }),
        memberIds: MEMBERS,
      })
    ).toEqual({ ok: false, reason: "bad-item-index" });
  });

  it("금액을 모르는 품목은 실패", () => {
    expect(
      applySplitPatch({
        patch: patch({ itemExclusions: [{ memberId: A, itemIndex: 1 }] }),
        expense: expense({ items: [{ amount: 1000 }, { amount: null }] }),
        memberIds: MEMBERS,
      })
    ).toEqual({ ok: false, reason: "item-amount-missing" });
  });

  it("한 품목에서 전원이 빠지면 실패", () => {
    expect(
      applySplitPatch({
        patch: patch({
          itemExclusions: MEMBERS.map((memberId) => ({ memberId, itemIndex: 0 })),
        }),
        expense: expense({ items }),
        memberIds: MEMBERS,
      })
    ).toEqual({ ok: false, reason: "item-nobody" });
  });
});

describe("applySplitPatch — guard", () => {
  it("expenseId 가 다르면 실패", () => {
    expect(
      applySplitPatch({
        patch: patch({ exclude: [A], expenseId: "33333333-3333-4333-8333-333333333333" }),
        expense: expense(),
        memberIds: MEMBERS,
      })
    ).toEqual({ ok: false, reason: "expense-mismatch" });
  });

  it("clarification 만 있는 patch 는 적용하지 않는다", () => {
    expect(
      applySplitPatch({
        patch: patch({ clarification: "누구요?" }),
        expense: expense(),
        memberIds: MEMBERS,
      })
    ).toEqual({ ok: false, reason: "clarification-needed" });
  });

  it("같은 입력이면 항상 같은 결과 (순수)", () => {
    const input = {
      patch: patch({ exclude: [C] }),
      expense: expense(),
      memberIds: MEMBERS,
    };
    expect(applySplitPatch(input)).toEqual(applySplitPatch(input));
  });
});

describe("helpers", () => {
  it("currentParticipants: 분담 0 이거나 멤버가 아닌 id 는 제외, 없으면 전체", () => {
    expect(currentParticipants({ [A]: 100, [B]: 0, ghost: 5 }, MEMBERS)).toEqual([A]);
    expect(currentParticipants({}, MEMBERS)).toEqual(MEMBERS);
  });

  it("sharesDigest: 키 순서와 무관하게 같은 문자열", () => {
    expect(sharesDigest({ [B]: 2, [A]: 1 })).toBe(sharesDigest({ [A]: 1, [B]: 2 }));
    expect(sharesDigest({ [A]: 1 })).not.toBe(sharesDigest({ [A]: 2 }));
  });

  it("모든 실패 사유에 한국어 메시지가 있다", () => {
    expect(splitPatchReasonMessage("no-change")).toMatch(/요/);
  });
});
