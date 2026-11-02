import { describe, expect, it } from "vitest";
import {
  explainReasonMessage,
  explainSettlement,
  reductionNote,
  type ExplainExpense,
  type ExplainMember,
} from "@/lib/ledger/explain";
import {
  computeBalances,
  computeShares,
  minimizeTransfers,
} from "@/lib/ledger/settle";

const members: ExplainMember[] = [
  { id: "a", name: "민수" },
  { id: "b", name: "지영" },
  { id: "c", name: "도현" },
];

const expenses: ExplainExpense[] = [
  {
    id: "e1",
    label: "점심",
    paidBy: "a",
    krwAmount: 30000,
    shares: { a: 10000, b: 10000, c: 10000 },
  },
  {
    id: "e2",
    label: "택시",
    paidBy: "b",
    krwAmount: 9000,
    shares: { a: 4500, b: 4500 },
  },
];

function transfersFor(list: ExplainExpense[]) {
  const bal = computeBalances(
    members.map((m) => m.id),
    list
  );
  return minimizeTransfers(bal);
}

describe("explainSettlement", () => {
  it("explains paid − owed = balance per member with per-expense lines", () => {
    const r = explainSettlement({
      members,
      expenses,
      transfers: transfersFor(expenses),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const [a, b, c] = r.memberRows;
    expect(a).toMatchObject({ paid: 30000, owed: 14500, balance: 15500 });
    expect(b).toMatchObject({ paid: 9000, owed: 14500, balance: -5500 });
    expect(c).toMatchObject({ paid: 0, owed: 10000, balance: -10000 });
    expect(a!.summary).toBe(
      "낸 돈 ₩30,000 − 쓴 몫 ₩14,500 = +₩15,500 (받을 돈)"
    );
    expect(c!.summary).toBe("낸 돈 ₩0 − 쓴 몫 ₩10,000 = -₩10,000 (보낼 돈)");

    expect(a!.lines).toEqual([
      { expenseId: "e1", label: "점심", paid: 30000, owed: 10000, net: 20000 },
      { expenseId: "e2", label: "택시", paid: 0, owed: 4500, net: -4500 },
    ]);
    // 줄 net 합 = 잔액
    for (const row of r.memberRows) {
      expect(row.lines.reduce((s, l) => s + l.net, 0)).toBe(row.balance);
    }
  });

  it("keeps invariants: balances sum 0, transfers sum = positive balances", () => {
    const transfers = transfersFor(expenses);
    const r = explainSettlement({ members, expenses, transfers });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.memberRows.reduce((s, m) => s + m.balance, 0)).toBe(0);
    const positive = r.memberRows
      .filter((m) => m.balance > 0)
      .reduce((s, m) => s + m.balance, 0);
    expect(transfers.reduce((s, t) => s + t.krw, 0)).toBe(positive);
    expect(r.totalKrw).toBe(positive);
    expect(r.transferNotes).toHaveLength(transfers.length);
  });

  it("holds invariants for uneven (remainder) splits built with computeShares", () => {
    const people = ["a", "b", "c"];
    const built: ExplainExpense[] = [100, 101, 7, 99999].map((amt, i) => {
      const s = computeShares({
        type: "equal",
        krwAmount: amt,
        participants: people,
      });
      if (!s.ok) throw new Error("shares");
      return {
        id: `x${i}`,
        label: `지출${i}`,
        paidBy: people[i % 3]!,
        krwAmount: amt,
        shares: s.shares,
      };
    });
    const r = explainSettlement({
      members,
      expenses: built,
      transfers: transfersFor(built),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const e of built) {
      expect(Object.values(e.shares).reduce((s, v) => s + v, 0)).toBe(
        e.krwAmount
      );
    }
    expect(r.memberRows.reduce((s, m) => s + m.balance, 0)).toBe(0);
  });

  it("writes template notes (no LLM) that follow the running balances", () => {
    const r = explainSettlement({
      members,
      expenses,
      transfers: [
        { from: "c", to: "a", krw: 10000 },
        { from: "b", to: "a", krw: 5500 },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.transferNotes[0]!.text).toBe(
      "도현님이 민수님에게 ₩10,000 보내요. 도현님은 ₩10,000 보낼 돈이 있고, 민수님은 ₩15,500 받을 돈이 있어요. 이 송금으로 도현님은 정산이 끝나요."
    );
    expect(r.transferNotes[1]!.text).toContain("두 분 모두 정산이 끝나요");
  });

  it("reports pairwise vs minimized transfer counts", () => {
    // a→b 1000, b→c 1000 (사슬): 쌍별 2번 → 합치면 a→c 1번
    const chain: ExplainExpense[] = [
      {
        id: "p1",
        label: "A가 B 몫",
        paidBy: "b",
        krwAmount: 1000,
        shares: { a: 1000 },
      },
      {
        id: "p2",
        label: "B가 C 몫",
        paidBy: "c",
        krwAmount: 1000,
        shares: { b: 1000 },
      },
    ];
    const transfers = transfersFor(chain);
    expect(transfers).toEqual([{ from: "a", to: "c", krw: 1000 }]);
    const r = explainSettlement({ members, expenses: chain, transfers });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reduction).toEqual({ pairwiseCount: 2, minimizedCount: 1 });
    expect(r.reductionNote).toBe(
      "둘씩 따로 주고받으면 2번 보내야 하지만, 서로 주고받을 돈을 합쳐서 1번으로 줄였어요."
    );
  });

  it("nets opposite debts between the same pair when counting pairwise", () => {
    const both: ExplainExpense[] = [
      {
        id: "q1",
        label: "x",
        paidBy: "a",
        krwAmount: 1000,
        shares: { b: 1000 },
      },
      {
        id: "q2",
        label: "y",
        paidBy: "b",
        krwAmount: 1000,
        shares: { a: 1000 },
      },
    ];
    const r = explainSettlement({ members, expenses: both, transfers: [] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reduction).toEqual({ pairwiseCount: 0, minimizedCount: 0 });
    expect(r.reductionNote).toBe("서로 보낼 돈이 없어요.");
  });

  it("does not claim a reduction when counts are equal", () => {
    expect(reductionNote({ pairwiseCount: 1, minimizedCount: 1 })).toBe(
      "송금은 1번이에요. 더 줄일 수 있는 송금은 없어요."
    );
  });

  it("explains balances even before a settlement exists (no transfers)", () => {
    const r = explainSettlement({ members, expenses, transfers: [] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.transferNotes).toEqual([]);
    expect(r.reduction.minimizedCount).toBe(0);
    expect(r.totalKrw).toBe(15500);
  });

  it("falls back to a placeholder label for unnamed expenses", () => {
    const r = explainSettlement({
      members,
      expenses: [{ ...expenses[0]!, label: "  " }],
      transfers: [],
    });
    expect(r.ok && r.memberRows[0]!.lines[0]!.label).toBe("이름 없는 지출");
  });

  describe("failures", () => {
    it("rejects shares that do not sum to krwAmount", () => {
      const r = explainSettlement({
        members,
        expenses: [{ ...expenses[0]!, shares: { a: 10000, b: 10000, c: 9999 } }],
        transfers: [],
      });
      expect(r).toEqual({ ok: false, reason: "share-mismatch" });
    });

    it("rejects transfers whose sum differs from positive balances", () => {
      const r = explainSettlement({
        members,
        expenses,
        transfers: [{ from: "c", to: "a", krw: 10000 }],
      });
      expect(r).toEqual({ ok: false, reason: "transfer-mismatch" });
    });

    it("rejects unknown members", () => {
      expect(
        explainSettlement({
          members,
          expenses: [{ ...expenses[0]!, paidBy: "zzz" }],
          transfers: [],
        })
      ).toEqual({ ok: false, reason: "unknown-member" });
      expect(
        explainSettlement({
          members,
          expenses: [],
          transfers: [{ from: "a", to: "zzz", krw: 1 }],
        })
      ).toEqual({ ok: false, reason: "unknown-member" });
    });

    it("rejects non-integer or negative amounts and self transfers", () => {
      expect(
        explainSettlement({
          members,
          expenses: [{ ...expenses[0]!, krwAmount: 30000.5 }],
          transfers: [],
        })
      ).toEqual({ ok: false, reason: "non-integer-or-negative" });
      expect(
        explainSettlement({
          members,
          expenses: [],
          transfers: [{ from: "a", to: "a", krw: 100 }],
        })
      ).toEqual({ ok: false, reason: "non-integer-or-negative" });
    });

    it("has a Korean message for every failure reason", () => {
      for (const reason of [
        "unknown-member",
        "non-integer-or-negative",
        "share-mismatch",
        "balances-not-zero",
        "transfer-mismatch",
      ] as const) {
        expect(explainReasonMessage(reason)).toMatch(/[가-힣]/);
      }
    });
  });
});
