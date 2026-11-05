import {
  computeShares,
  type MemberId,
} from "@/lib/ledger/settle";

/**
 * 공유 정산(/s) 화면용 — 서버가 준 지출·멤버로 **미리보기** 분담만 계산한다.
 * 저장·RPC 쓰기는 하지 않는다. 확정 분담은 split-patch API + 서버 재계산.
 */

export type ShareSplitExpense = {
  id: string;
  paidBy: MemberId;
  krwAmount: number;
  /** 품목 라벨(술 제외 휴리스틱용). 없으면 제외 대상 아님. */
  label?: string;
  /** 이미 저장된 몫(멤버→KRW). 제외 없으면 그대로 사용. */
  shares?: Record<MemberId, number>;
};

const ALCOHOL_RE = /술|주류|맥주|소주|와인|위스키|칵테일|sake|beer|wine|soju/i;

export type CalculateSplitInput = {
  memberIds: MemberId[];
  expenses: ShareSplitExpense[];
  /**
   * 멤버별 제외 모드.
   * - `alcohol`: 라벨이 주류로 보이면 해당 멤버를 그 지출에서 제외
   * - `expenseIds`: 지정 지출에서 제외
   */
  exclusions?: Partial<
    Record<
      MemberId,
      { alcohol?: boolean; expenseIds?: string[] }
    >
  >;
};

export type CalculateSplitResult = {
  /** 지출별 최종 몫 */
  byExpense: Array<{
    expenseId: string;
    shares: Record<MemberId, number>;
  }>;
  /** 멤버별 내야 할 합(몫 합, 정수 KRW) */
  individualAmount: Record<MemberId, number>;
};

/**
 * 1/N + 멤버별 제외를 순수 함수로 미리보기한다.
 * 금액 출처는 항상 expense.krwAmount (서버 값).
 */
export function calculateSplit(
  input: CalculateSplitInput
): CalculateSplitResult {
  const individualAmount: Record<MemberId, number> = {};
  for (const id of input.memberIds) individualAmount[id] = 0;

  const byExpense: CalculateSplitResult["byExpense"] = [];

  for (const exp of input.expenses) {
    if (!Number.isInteger(exp.krwAmount) || exp.krwAmount < 0) {
      byExpense.push({ expenseId: exp.id, shares: exp.shares ?? {} });
      continue;
    }

    const exclude = new Set<MemberId>();
    for (const mid of input.memberIds) {
      const rule = input.exclusions?.[mid];
      if (!rule) continue;
      if (rule.expenseIds?.includes(exp.id)) {
        exclude.add(mid);
        continue;
      }
      if (rule.alcohol && exp.label && ALCOHOL_RE.test(exp.label)) {
        exclude.add(mid);
      }
    }

    let shares: Record<MemberId, number>;
    if (exclude.size === 0 && exp.shares && Object.keys(exp.shares).length > 0) {
      shares = exp.shares;
    } else {
      const participants = input.memberIds.filter((id) => !exclude.has(id));
      const r = computeShares({
        type: "equal",
        krwAmount: exp.krwAmount,
        participants: participants.length > 0 ? participants : input.memberIds,
      });
      shares = r.ok ? r.shares : {};
    }

    byExpense.push({ expenseId: exp.id, shares });
    for (const [mid, krw] of Object.entries(shares)) {
      individualAmount[mid] = (individualAmount[mid] ?? 0) + krw;
    }
  }

  return { byExpense, individualAmount };
}
