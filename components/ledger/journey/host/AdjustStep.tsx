"use client";

import { ListChecks, Receipt } from "lucide-react";
import { useState } from "react";
import { BottomCTA } from "@/components/ds/BottomCTA";
import { Button } from "@/components/ds/Button";
import { EmptyState } from "@/components/ds/EmptyState";
import { ExpenseChipSplit } from "@/components/ledger/ExpenseChipSplit";
import { SplitBatchBox } from "@/components/ledger/SplitBatchBox";
import { SplitPatchBox } from "@/components/ledger/SplitPatchBox";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";

type Props = {
  tripId: string;
  expenses: LedgerExpenseRow[];
  members: TripMember[];
  meId: string | undefined;
  isOwner: boolean;
  isAnonymous: boolean;
  /** 적용·되돌리기 뒤 목록·정산을 다시 읽어요. */
  onChanged: () => void;
  /** 「문제없어요, 정산할게요」 → 정산 단계 */
  onSettle: () => void;
  /** 지출이 없을 때 기록 단계로 */
  onRecord: () => void;
};

/**
 * 호스트 ④ 분담 단계(선택). 분담 계산은 서버가 해요:
 * LLM 은 문장 해석만, 칩은 chipToPatch(LLM 없음), 모두 미리보기 → 적용 → 되돌리기.
 */
export function AdjustStep({
  tripId,
  expenses,
  members,
  meId,
  isOwner,
  isAnonymous,
  onChanged,
  onSettle,
  onRecord,
}: Props) {
  const [changes, setChanges] = useState(0);
  const changed = () => {
    setChanges((n) => n + 1);
    onChanged();
  };

  if (expenses.length === 0) {
    return (
      <div className="rounded-mu-xl border border-mu-line bg-mu-card p-4">
        <EmptyState
          icon={Receipt}
          title="조정할 지출이 없어요"
          body="지출을 먼저 기록하면 여기서 사람별 몫을 바꿀 수 있어요."
          action={<Button onClick={onRecord}>기록하러 가기</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <div>
        <h2 className="text-mu-title text-mu-fg">정산 전에 안 맞는 게 있나요?</h2>
        <p className="mt-1 text-mu-body text-mu-fg-2">
          없으면 바로 정산해도 돼요. 바꾸면 먼저 미리 보고, 확정한 뒤에도 되돌릴 수
          있어요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <SplitBatchBox tripId={tripId} onChanged={changed} />
        <SplitPatchBox tripId={tripId} onChanged={changed} />
      </div>

      <section aria-labelledby="adjust-chips-title" className="flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks
              className="h-5 w-5 text-mu-accent"
              strokeWidth={1.75}
              aria-hidden
            />
            <h3 id="adjust-chips-title" className="text-mu-heading text-mu-fg">
              지출별로 빼고 넣기
            </h3>
          </div>
          <p className="mt-1 text-mu-caption text-mu-fg-3">
            사람 칩을 누르면 바뀐 몫을 먼저 보여 줘요.
            {isOwner && !isAnonymous ? " 결제자도 여기서 바꿔요." : ""}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {expenses.map((e) => (
            <ExpenseChipSplit
              key={e.id}
              expense={e}
              members={members}
              meId={meId}
              isAnonymous={isAnonymous}
              isOwner={isOwner}
              settleHref={`/trips/${tripId}/ledger/settle`}
              onChanged={changed}
            />
          ))}
        </ul>
      </section>

      <BottomCTA
        label="문제없어요, 정산할게요"
        onClick={onSettle}
        hint={
          changes > 0
            ? `이번에 분담을 ${changes}번 바꿨어요. 정산에 반영돼요.`
            : undefined
        }
      />
    </div>
  );
}
