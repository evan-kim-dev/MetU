import { describe, expect, it } from "vitest";
import {
  basisHash,
  computeBalances,
  computeShares,
  minimizeTransfers,
  minimizeTransfersGreedy,
  splitEqual,
  toKrw,
  validateShares,
  type LedgerExpense,
} from "@/lib/ledger/settle";

describe("splitEqual / computeShares equal", () => {
  it("splits 10000 into 3 with exact sum", () => {
    const s = splitEqual(10000, ["c", "a", "b"]);
    const vals = Object.values(s);
    expect(vals.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
  });

  it("splits 1 won into 3", () => {
    const s = splitEqual(1, ["a", "b", "c"]);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("same input always same result", () => {
    const a = computeShares({
      type: "equal",
      krwAmount: 10000,
      participants: ["c", "a", "b"],
    });
    const b = computeShares({
      type: "equal",
      krwAmount: 10000,
      participants: ["b", "c", "a"],
    });
    expect(a).toEqual(b);
  });

  it("0 participants fails", () => {
    const r = computeShares({ type: "equal", krwAmount: 100, participants: [] });
    expect(r.ok).toBe(false);
  });
});

describe("computeShares ratio / fixed", () => {
  it("ratio 2:1:1 of 100001", () => {
    const r = computeShares({
      type: "ratio",
      krwAmount: 100001,
      participants: ["a", "b", "c"],
      inputs: { a: 2, b: 1, c: 1 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.values(r.shares).reduce((x, y) => x + y, 0)).toBe(100001);
    expect(r.shares.a).toBe(50001);
  });

  it("rejects non-positive ratio", () => {
    const r = computeShares({
      type: "ratio",
      krwAmount: 100,
      participants: ["a", "b"],
      inputs: { a: 1, b: 0 },
    });
    expect(r.ok).toBe(false);
  });

  it("fixed 3000/1500/1500 of 6000 JPY -> 54000 KRW", () => {
    const r = computeShares({
      type: "fixed",
      krwAmount: 54000,
      participants: ["a", "b", "c"],
      inputs: { a: 3000, b: 1500, c: 1500 },
      totalOriginal: 6000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shares).toEqual({ a: 27000, b: 13500, c: 13500 });
  });

  it("fixed sum mismatch fails", () => {
    const r = computeShares({
      type: "fixed",
      krwAmount: 54000,
      participants: ["a", "b"],
      inputs: { a: 3000, b: 1000 },
      totalOriginal: 6000,
    });
    expect(r.ok).toBe(false);
  });
});

describe("computeBalances / minimizeTransfers", () => {
  it("A pays 30000 equal among 3", () => {
    const members = ["A", "B", "C"];
    const shares = splitEqual(30000, members);
    const expenses: LedgerExpense[] = [
      { id: "1", paidBy: "A", krwAmount: 30000, shares },
    ];
    const bal = computeBalances(members, expenses);
    expect(bal.A).toBe(20000);
    expect(bal.B).toBe(-10000);
    expect(bal.C).toBe(-10000);
    expect(Object.values(bal).reduce((a, b) => a + b, 0)).toBe(0);

    const transfers = minimizeTransfers(bal);
    expect(transfers.length).toBeLessThanOrEqual(2);
    const after = { ...bal };
    for (const t of transfers) {
      after[t.from]! += t.krw;
      after[t.to]! -= t.krw;
    }
    for (const v of Object.values(after)) expect(v).toBe(0);
  });

  it("already settled -> empty", () => {
    expect(minimizeTransfers({ a: 0, b: 0 })).toEqual([]);
  });

  it("exact <= greedy count", () => {
    const bal = { a: 50, b: -30, c: -20, d: 10, e: -10 };
    const exact = minimizeTransfers(bal);
    const greedy = minimizeTransfersGreedy(bal);
    expect(exact.length).toBeLessThanOrEqual(greedy.length);
  });

  it("deterministic", () => {
    const bal = { z: 100, a: -40, m: -60 };
    expect(minimizeTransfers(bal)).toEqual(minimizeTransfers(bal));
  });

  it("property: random expenses settle to zero (seeded)", () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let trial = 0; trial < 500; trial++) {
      const n = 2 + Math.floor(rand() * 4);
      const members = Array.from({ length: n }, (_, i) => `m${i}`);
      const expenses: LedgerExpense[] = [];
      const count = 1 + Math.floor(rand() * 5);
      for (let e = 0; e < count; e++) {
        const total = 1000 + Math.floor(rand() * 50000);
        const paidBy = members[Math.floor(rand() * n)]!;
        expenses.push({
          id: `e${trial}-${e}`,
          paidBy,
          krwAmount: total,
          shares: splitEqual(total, members),
        });
      }
      const bal = computeBalances(members, expenses);
      expect(Object.values(bal).reduce((a, b) => a + b, 0)).toBe(0);
      const transfers = minimizeTransfers(bal);
      expect(transfers.length).toBeLessThanOrEqual(n - 1);
      const after = { ...bal };
      for (const t of transfers) {
        after[t.from]! += t.krw;
        after[t.to]! -= t.krw;
      }
      for (const v of Object.values(after)) expect(Math.abs(v)).toBe(0);
    }
  });
});

describe("basisHash", () => {
  it("order independent, amount sensitive", async () => {
    const a: LedgerExpense[] = [
      { id: "2", paidBy: "b", krwAmount: 100, shares: { a: 50, b: 50 } },
      { id: "1", paidBy: "a", krwAmount: 200, shares: { a: 100, b: 100 } },
    ];
    const b: LedgerExpense[] = [
      { id: "1", paidBy: "a", krwAmount: 200, shares: { b: 100, a: 100 } },
      { id: "2", paidBy: "b", krwAmount: 100, shares: { a: 50, b: 50 } },
    ];
    const c: LedgerExpense[] = [
      { id: "1", paidBy: "a", krwAmount: 201, shares: { a: 101, b: 100 } },
      { id: "2", paidBy: "b", krwAmount: 100, shares: { a: 50, b: 50 } },
    ];
    expect(await basisHash(a)).toBe(await basisHash(b));
    expect(await basisHash(a)).not.toBe(await basisHash(c));
  });
});

describe("validateShares / toKrw", () => {
  it("rejects sum mismatch", () => {
    expect(validateShares(100, { a: 40, b: 50 }).ok).toBe(false);
  });
  it("rejects negative", () => {
    expect(validateShares(100, { a: -1, b: 101 }).ok).toBe(false);
  });
  it("rounds fx", () => {
    expect(toKrw(4500, 9.12)).toBe(41040);
  });
});
