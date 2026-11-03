import { z } from "zod";

import {
  computeShares,
  validateShares,
  type MemberId,
} from "@/lib/ledger/settle";

/**
 * 자연어 분담 수정 (K7).
 *
 * LLM 은 "누구를 어떻게 바꿀지"만 구조화해서 돌려준다. 금액·환율·분담액 필드는 스키마에
 * 아예 없고(strict), 실제 분담액은 이 파일의 순수 함수(applySplitPatch)가 settle.ts 의
 * computeShares / validateShares 로 계산한다. LLM 호출은 여기에 없다.
 */

const MemberRef = z.string().trim().min(1).max(64);

const WeightEntry = z.strictObject({
  memberId: MemberRef,
  /** 비율(예: 2 = 다른 사람의 두 배). 금액이 아니다. */
  weight: z.number().positive().max(1000),
});

const ItemExclusionEntry = z.strictObject({
  memberId: MemberRef,
  /** expense.items 배열의 0부터 시작하는 순번 */
  itemIndex: z.number().int().min(0).max(199),
});

export const CLARIFICATION_MAX = 200;
/** 미리보기 API 에 보내는 자연어 요청 최대 길이. */
export const SPLIT_PATCH_TEXT_MAX = 300;

/**
 * exclude / only / weights / itemExclusions 중 정확히 하나만 비어 있지 않아야 한다.
 * 단, 의도가 모호하면 모델이 네 가지를 모두 비우고 clarification 에 되묻는 말만 담을 수 있다.
 */
export const SplitPatchSchema = z
  .strictObject({
    expenseId: z.string().uuid(),
    exclude: z.array(MemberRef).max(20),
    only: z.array(MemberRef).max(20),
    weights: z.array(WeightEntry).max(20),
    itemExclusions: z.array(ItemExclusionEntry).max(100),
    clarification: z.string().trim().max(CLARIFICATION_MAX).nullable(),
  })
  .superRefine((patch, ctx) => {
    const filled = patchKinds(patch).length;
    const hasClarification = Boolean(patch.clarification);
    if (filled === 1) return;
    if (filled === 0 && hasClarification) return;
    ctx.addIssue({
      code: "custom",
      message:
        "exclude, only, weights, itemExclusions 중 하나만 채워야 해요 (모호하면 clarification 만).",
    });
  });

export type SplitPatch = z.infer<typeof SplitPatchSchema>;
export type SplitPatchKind = "exclude" | "only" | "weights" | "itemExclusions";

/** 배치 미리보기 응답용. expenseId 는 서버가 채운 실제 UUID. */
export const BatchSplitPatchSchema = z.strictObject({
  patches: z.array(SplitPatchSchema).max(10),
  clarification: z.string().trim().max(CLARIFICATION_MAX).nullable(),
});

export type BatchSplitPatch = z.infer<typeof BatchSplitPatchSchema>;

/**
 * LLM 출력용. 지출은 번호(expenseIndex)로만 받고 서버가 UUID 로 바꾼다.
 * 금액 계열 키는 SplitPatchSchema 와 같이 없다.
 */
export const BatchSplitPatchLlmSchema = z
  .strictObject({
    patches: z
      .array(
        z.strictObject({
          expenseIndex: z.number().int().min(0).max(19),
          exclude: z.array(MemberRef).max(20),
          only: z.array(MemberRef).max(20),
          weights: z.array(WeightEntry).max(20),
          itemExclusions: z.array(ItemExclusionEntry).max(100),
          clarification: z.string().trim().max(CLARIFICATION_MAX).nullable(),
        })
      )
      .max(10),
    clarification: z.string().trim().max(CLARIFICATION_MAX).nullable(),
  })
  .superRefine((batch, ctx) => {
    for (let i = 0; i < batch.patches.length; i++) {
      const p = batch.patches[i]!;
      const filled = patchKinds(p).length;
      const hasClarification = Boolean(p.clarification);
      if (filled === 1) continue;
      if (filled === 0 && hasClarification) continue;
      ctx.addIssue({
        code: "custom",
        path: ["patches", i],
        message:
          "exclude, only, weights, itemExclusions 중 하나만 채워야 해요.",
      });
    }
  });

export type BatchSplitPatchLlm = z.infer<typeof BatchSplitPatchLlmSchema>;

export function patchKinds(
  patch: Pick<SplitPatch, "exclude" | "only" | "weights" | "itemExclusions">
): SplitPatchKind[] {
  const kinds: SplitPatchKind[] = [];
  if (patch.exclude.length > 0) kinds.push("exclude");
  if (patch.only.length > 0) kinds.push("only");
  if (patch.weights.length > 0) kinds.push("weights");
  if (patch.itemExclusions.length > 0) kinds.push("itemExclusions");
  return kinds;
}

export type SplitPatchFailReason =
  | "expense-mismatch"
  | "clarification-needed"
  | "unknown-member"
  | "duplicate-member"
  | "nobody-left"
  | "no-items"
  | "bad-item-index"
  | "item-amount-missing"
  | "item-nobody"
  | "no-change"
  | "compute-failed"
  | "invalid-shares";

export type SplitPatchExpense = {
  id: string;
  krwAmount: number;
  shares: Record<MemberId, number>;
  items: ReadonlyArray<{ amount?: number | null }>;
};

export type SplitPatchSplitType = "equal" | "ratio" | "fixed";

export type ApplySplitPatchResult =
  | {
      ok: true;
      kind: SplitPatchKind;
      splitType: SplitPatchSplitType;
      shares: Record<MemberId, number>;
      /** ratio 일 때만 비율 입력값. 나머지는 빈 객체(= DB input_value null). */
      inputValues: Record<MemberId, number>;
    }
  | { ok: false; reason: SplitPatchFailReason };

const REASON_MESSAGES: Record<SplitPatchFailReason, string> = {
  "expense-mismatch": "다른 지출에 대한 요청이에요. 다시 골라 주세요.",
  "clarification-needed": "요청을 정확히 이해하지 못했어요. 조금 더 자세히 적어 주세요.",
  "unknown-member": "여행 멤버가 아닌 이름이 있어요. 이름을 확인해 주세요.",
  "duplicate-member": "같은 멤버가 두 번 들어 있어요. 다시 말씀해 주세요.",
  "nobody-left": "나눌 사람이 아무도 남지 않아요. 한 명 이상은 남겨 주세요.",
  "no-items": "이 지출에는 품목 정보가 없어서 품목별로 나눌 수 없어요.",
  "bad-item-index": "찾을 수 없는 품목이에요. 품목 이름을 확인해 주세요.",
  "item-amount-missing": "금액을 알 수 없는 품목이라 나눌 수 없어요.",
  "item-nobody": "한 품목에서 모든 사람이 빠질 수는 없어요.",
  "no-change": "지금 분담과 달라지는 게 없어요.",
  "compute-failed": "분담액을 계산하지 못했어요. 다시 시도해 주세요.",
  "invalid-shares": "계산한 분담액이 맞지 않아요. 다시 시도해 주세요.",
};

export function splitPatchReasonMessage(reason: SplitPatchFailReason): string {
  return REASON_MESSAGES[reason];
}

/**
 * 익명 게스트는 자기 몫만 바꿀 수 있다 (K7b).
 * weights/only 불가, exclude·itemExclusions 는 요청자 본인만.
 */
export function guestMayApply(args: {
  patch: Pick<
    SplitPatch,
    "exclude" | "only" | "weights" | "itemExclusions"
  >;
  requesterMemberId: string;
}): { ok: true } | { ok: false; code: "guest-self-only" } {
  const { patch, requesterMemberId } = args;
  const kinds = patchKinds(patch);
  if (kinds.includes("weights") || kinds.includes("only")) {
    return { ok: false, code: "guest-self-only" };
  }
  if (kinds.includes("exclude")) {
    const ids = [...new Set(patch.exclude)];
    if (ids.length !== 1 || ids[0] !== requesterMemberId) {
      return { ok: false, code: "guest-self-only" };
    }
  }
  if (kinds.includes("itemExclusions")) {
    if (
      patch.itemExclusions.length === 0 ||
      patch.itemExclusions.some((e) => e.memberId !== requesterMemberId)
    ) {
      return { ok: false, code: "guest-self-only" };
    }
  }
  return { ok: true };
}

export const GUEST_SELF_ONLY_MESSAGE =
  "다른 사람의 분담은 호스트만 바꿀 수 있어요.";

/**
 * 멤버 칩 탭 → SplitPatch (LLM 없음). exclude / include 만.
 */
export function chipToPatch(args: {
  expenseId: string;
  memberId: string;
  action: "exclude" | "include";
  currentParticipants: readonly string[];
}):
  | { ok: true; patch: SplitPatch }
  | { ok: false; reason: SplitPatchFailReason } {
  const { expenseId, memberId, action } = args;
  const participants = [...new Set(args.currentParticipants)];

  if (action === "exclude") {
    if (!participants.includes(memberId)) {
      return { ok: false, reason: "no-change" };
    }
    if (participants.filter((id) => id !== memberId).length === 0) {
      return { ok: false, reason: "nobody-left" };
    }
    return {
      ok: true,
      patch: {
        expenseId,
        exclude: [memberId],
        only: [],
        weights: [],
        itemExclusions: [],
        clarification: null,
      },
    };
  }

  if (participants.includes(memberId)) {
    return { ok: false, reason: "no-change" };
  }
  return {
    ok: true,
    patch: {
      expenseId,
      exclude: [],
      only: [...participants, memberId],
      weights: [],
      itemExclusions: [],
      clarification: null,
    },
  };
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/** 현재 분담에 참여 중인 멤버(분담액 > 0). 하나도 없으면 전체 멤버. */
export function currentParticipants(
  shares: Record<MemberId, number>,
  memberIds: readonly MemberId[]
): MemberId[] {
  const known = new Set(memberIds);
  const present = Object.entries(shares)
    .filter(([id, krw]) => known.has(id) && krw > 0)
    .map(([id]) => id);
  return present.length > 0 ? present : unique(memberIds);
}

/** 미리보기 → 적용 사이 충돌 감지용. 분담이 같으면 같은 문자열. */
export function sharesDigest(shares: Record<MemberId, number>): string {
  return Object.keys(shares)
    .sort()
    .map((id) => `${id}=${shares[id]}`)
    .join(";");
}

function sameShares(
  a: Record<MemberId, number>,
  b: Record<MemberId, number>
): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    if ((a[id] ?? 0) !== (b[id] ?? 0)) return false;
  }
  return true;
}

function equalAmong(
  krwAmount: number,
  participants: MemberId[]
): Record<MemberId, number> | null {
  const r = computeShares({ type: "equal", krwAmount, participants });
  return r.ok ? r.shares : null;
}

function itemKey(index: number): string {
  return `i${String(index).padStart(4, "0")}`;
}

function applyItemExclusions(
  patch: SplitPatch,
  expense: SplitPatchExpense,
  base: MemberId[],
  known: Set<MemberId>
):
  | { ok: true; shares: Record<MemberId, number> }
  | { ok: false; reason: SplitPatchFailReason } {
  if (expense.items.length === 0) return { ok: false, reason: "no-items" };

  const excluded = new Map<number, Set<MemberId>>();
  for (const entry of patch.itemExclusions) {
    if (!known.has(entry.memberId)) {
      return { ok: false, reason: "unknown-member" };
    }
    const item = expense.items[entry.itemIndex];
    if (!item) return { ok: false, reason: "bad-item-index" };
    const set = excluded.get(entry.itemIndex) ?? new Set<MemberId>();
    set.add(entry.memberId);
    excluded.set(entry.itemIndex, set);
  }

  // 금액을 아는 품목끼리 지출 전체(세금·봉사료 포함)를 비율로 나눈다.
  const usable: Array<{ index: number; amount: number }> = [];
  expense.items.forEach((item, index) => {
    const amount = item.amount;
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
      usable.push({ index, amount });
    }
  });
  if (usable.length === 0) return { ok: false, reason: "item-amount-missing" };
  for (const index of excluded.keys()) {
    if (!usable.some((u) => u.index === index)) {
      return { ok: false, reason: "item-amount-missing" };
    }
  }

  const inputs: Record<string, number> = {};
  for (const u of usable) inputs[itemKey(u.index)] = u.amount;
  const perItem = computeShares({
    type: "ratio",
    krwAmount: expense.krwAmount,
    participants: usable.map((u) => itemKey(u.index)),
    inputs,
  });
  if (!perItem.ok) return { ok: false, reason: "compute-failed" };

  const totals: Record<MemberId, number> = {};
  for (const id of base) totals[id] = 0;

  for (const u of usable) {
    const itemKrw = perItem.shares[itemKey(u.index)] ?? 0;
    const out = excluded.get(u.index);
    const eligible = base.filter((id) => !out?.has(id));
    if (eligible.length === 0) return { ok: false, reason: "item-nobody" };
    const split = equalAmong(itemKrw, eligible);
    if (!split) return { ok: false, reason: "compute-failed" };
    for (const [id, krw] of Object.entries(split)) {
      totals[id] = (totals[id] ?? 0) + krw;
    }
  }
  return { ok: true, shares: totals };
}

/**
 * 순수 함수. patch + 서버가 읽은 지출/멤버로 새 분담을 계산한다.
 * 금액은 expense.krwAmount(서버 값)에서만 나오고, 합이 어긋나면 실패한다.
 */
export function applySplitPatch(input: {
  patch: SplitPatch;
  expense: SplitPatchExpense;
  memberIds: readonly MemberId[];
}): ApplySplitPatchResult {
  const { patch, expense, memberIds } = input;
  if (patch.expenseId !== expense.id) {
    return { ok: false, reason: "expense-mismatch" };
  }
  const kinds = patchKinds(patch);
  if (kinds.length !== 1) {
    return { ok: false, reason: "clarification-needed" };
  }
  const kind = kinds[0]!;

  const known = new Set(memberIds);
  const base = currentParticipants(expense.shares, memberIds);

  let splitType: SplitPatchSplitType;
  let shares: Record<MemberId, number> | null = null;
  let inputValues: Record<MemberId, number> = {};

  if (kind === "exclude" || kind === "only") {
    const listed = kind === "exclude" ? patch.exclude : patch.only;
    if (listed.some((id) => !known.has(id))) {
      return { ok: false, reason: "unknown-member" };
    }
    const ids = unique(listed);
    const participants =
      kind === "exclude" ? base.filter((id) => !ids.includes(id)) : ids;
    if (participants.length === 0) return { ok: false, reason: "nobody-left" };
    shares = equalAmong(expense.krwAmount, participants);
    splitType = "equal";
  } else if (kind === "weights") {
    const ids = patch.weights.map((w) => w.memberId);
    if (ids.some((id) => !known.has(id))) {
      return { ok: false, reason: "unknown-member" };
    }
    if (unique(ids).length !== ids.length) {
      return { ok: false, reason: "duplicate-member" };
    }
    // 말하지 않은 참여자는 비율 1 로 둔다.
    const participants = unique([...base, ...ids]);
    const weightOf = new Map(patch.weights.map((w) => [w.memberId, w.weight]));
    const inputs: Record<MemberId, number> = {};
    for (const id of participants) inputs[id] = weightOf.get(id) ?? 1;
    const r = computeShares({
      type: "ratio",
      krwAmount: expense.krwAmount,
      participants,
      inputs,
    });
    shares = r.ok ? r.shares : null;
    inputValues = inputs;
    splitType = "ratio";
  } else {
    const r = applyItemExclusions(patch, expense, base, known);
    if (!r.ok) return r;
    shares = r.shares;
    splitType = "fixed";
  }

  if (!shares) return { ok: false, reason: "compute-failed" };
  if (!validateShares(expense.krwAmount, shares).ok) {
    return { ok: false, reason: "invalid-shares" };
  }
  if (sameShares(shares, expense.shares)) {
    return { ok: false, reason: "no-change" };
  }

  return { ok: true, kind, splitType, shares, inputValues };
}
