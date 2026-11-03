"use client";

import { UserX } from "lucide-react";
import { EmptyState } from "@/components/ds/EmptyState";
import { ExpenseChipSplit } from "@/components/ledger/ExpenseChipSplit";
import { GuestExpenseSlot } from "@/components/ledger/GuestExpenseSlot";
import { SplitBatchBox } from "@/components/ledger/SplitBatchBox";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";

type Props = {
  tripId: string;
  userId: string;
  members: TripMember[];
  expenses: LedgerExpenseRow[];
  onChanged: () => void;
  onBack: () => void;
};

/**
 * 게스트 조정: 내 몫만 바꾸기(한 줄·칩) + 「내가 냈어요」 제안.
 * 권한은 서버가 다시 확인해요(본인 몫만, 422 guest-self-only).
 */
export function GuestAdjust({
  tripId,
  userId,
  members,
  expenses,
  onChanged,
  onBack,
}: Props) {
  const me = members.find((m) => m.userId === userId);

  if (!me) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <EmptyState
          icon={UserX}
          title="아직 이 여행 멤버가 아니에요"
          body="초대 링크로 다시 들어와 주세요."
          action={
            <button
              type="button"
              className="mu-focus min-h-[44px] text-mu-label text-mu-accent"
              onClick={onBack}
            >
              내 몫으로
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-4">
      <section className="flex flex-col gap-2" aria-labelledby="guest-adjust-ai">
        <h2 id="guest-adjust-ai" className="text-mu-heading text-mu-fg">
          한 줄로 내 몫 바꾸기
        </h2>
        <p className="text-mu-caption text-mu-fg-3">
          예: 「저는 술 안 마셨어요」. 미리 보고 확정해요. 내 몫만 바뀌어요.
        </p>
        <SplitBatchBox tripId={tripId} onChanged={onChanged} />
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="guest-adjust-paid">
        <h2 id="guest-adjust-paid" className="text-mu-heading text-mu-fg">
          내가 낸 지출이 있어요
        </h2>
        <p className="text-mu-caption text-mu-fg-3">
          호스트가 확인하기 전에는 정산에 들어가지 않아요.
        </p>
        <GuestExpenseSlot
          tripId={tripId}
          members={members}
          meId={me.id}
          userId={userId}
        />
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="guest-adjust-list">
        <h2 id="guest-adjust-list" className="text-mu-heading text-mu-fg">
          지출별로 나 빼기
        </h2>
        {expenses.length === 0 ? (
          <p className="text-mu-body text-mu-fg-2">아직 지출이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {expenses.map((e) => (
              <ExpenseChipSplit
                key={e.id}
                expense={e}
                members={members}
                meId={me.id}
                isAnonymous
                isOwner={false}
                settleHref={`/trips/${tripId}/ledger/settle`}
                onChanged={onChanged}
              />
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        className="mu-focus min-h-[44px] self-center text-mu-label text-mu-accent"
        onClick={onBack}
      >
        내 몫으로
      </button>
    </div>
  );
}
