import { describe, expect, it, vi } from "vitest";

import {
  BatchSplitPatchLlmSchema,
  BatchSplitPatchSchema,
} from "@/lib/ledger/split-patch";
import { mapBatchLlmToPatches } from "@/lib/ledger/split-patch-server";

vi.mock("server-only", () => ({}));

const E1 = "11111111-1111-4111-8111-111111111111";
const E2 = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const expenses = [
  {
    expenseId: E1,
    label: "저녁",
    spentOn: "2026-11-01",
    participantNames: ["민수", "나"],
    itemNames: ["맥주", "치킨"],
    expense: {
      id: E1,
      krwAmount: 20000,
      shares: { [A]: 10000, [B]: 10000 },
      items: [{ amount: 8000 }, { amount: 12000 }],
    },
  },
  {
    expenseId: E2,
    label: "카페",
    spentOn: "2026-11-01",
    participantNames: ["민수", "나"],
    itemNames: ["맥주"],
    expense: {
      id: E2,
      krwAmount: 10000,
      shares: { [A]: 5000, [B]: 5000 },
      items: [{ amount: 10000 }],
    },
  },
];

describe("BatchSplitPatchSchema", () => {
  it("accepts up to 10 patches", () => {
    const patch = {
      expenseId: E1,
      exclude: [A],
      only: [],
      weights: [],
      itemExclusions: [],
      clarification: null,
    };
    expect(
      BatchSplitPatchSchema.safeParse({
        patches: [patch],
        clarification: null,
      }).success
    ).toBe(true);
  });
});

describe("mapBatchLlmToPatches", () => {
  it("maps expenseIndex to real ids for two patches", () => {
    const llm = BatchSplitPatchLlmSchema.parse({
      patches: [
        {
          expenseIndex: 0,
          exclude: [],
          only: [],
          weights: [],
          itemExclusions: [{ memberId: A, itemIndex: 0 }],
          clarification: null,
        },
        {
          expenseIndex: 1,
          exclude: [],
          only: [],
          weights: [],
          itemExclusions: [{ memberId: A, itemIndex: 0 }],
          clarification: null,
        },
      ],
      clarification: null,
    });
    const mapped = mapBatchLlmToPatches({ llm, expenses });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.batch.patches).toHaveLength(2);
    expect(mapped.batch.patches[0]?.expenseId).toBe(E1);
    expect(mapped.batch.patches[1]?.expenseId).toBe(E2);
  });

  it("rejects out-of-range expenseIndex", () => {
    const llm = BatchSplitPatchLlmSchema.parse({
      patches: [
        {
          expenseIndex: 9,
          exclude: [A],
          only: [],
          weights: [],
          itemExclusions: [],
          clarification: null,
        },
      ],
      clarification: null,
    });
    expect(mapBatchLlmToPatches({ llm, expenses })).toEqual({
      ok: false,
      error: "bad-index",
    });
  });

  it("rejects more than 10 patches at schema", () => {
    const one = {
      expenseIndex: 0,
      exclude: [A],
      only: [],
      weights: [],
      itemExclusions: [],
      clarification: null,
    };
    const parsed = BatchSplitPatchLlmSchema.safeParse({
      patches: Array.from({ length: 11 }, () => one),
      clarification: null,
    });
    expect(parsed.success).toBe(false);
  });
});
