"use client";

import { currentParticipants } from "@/lib/ledger/split-patch";
import type { TripMember } from "@/lib/ledger/types";

type Props = {
  members: TripMember[];
  shares: Record<string, number>;
  /** 탭 가능하면 호출. 비활성 칩은 호출하지 않음. */
  onToggle: (memberId: string, action: "exclude" | "include") => void;
  /** 활성 가능한 멤버 id. 없으면 전부 비활성. */
  interactiveMemberIds: ReadonlySet<string>;
  disabled?: boolean;
};

/**
 * 지출 카드의 멤버 칩. 참여=채움, 제외=윤곽+취소선.
 * 색만으로 상태를 구분하지 않고 취소선·aria-pressed 를 같이 쓴다.
 */
export function ExpenseMemberChips({
  members,
  shares,
  onToggle,
  interactiveMemberIds,
  disabled,
}: Props) {
  if (members.length === 0) return null;
  const memberIds = members.map((m) => m.id);
  const participating = new Set(currentParticipants(shares, memberIds));

  return (
    <ul
      className="mt-2 flex flex-wrap gap-1.5"
      aria-label="분담 멤버"
    >
      {members.map((m) => {
        const inSplit = participating.has(m.id);
        const canEdit = !disabled && interactiveMemberIds.has(m.id);
        return (
          <li key={m.id}>
            <button
              type="button"
              disabled={!canEdit}
              aria-pressed={inSplit}
              aria-label={
                inSplit
                  ? `${m.displayName}, 참여 중`
                  : `${m.displayName}, 제외됨`
              }
              title={
                canEdit
                  ? inSplit
                    ? "탭하면 제외해요"
                    : "탭하면 다시 포함해요"
                  : "호스트만 바꿀 수 있어요"
              }
              className={[
                "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 text-xs font-bold transition-colors",
                inSplit
                  ? "bg-brand/15 text-brand ring-1 ring-brand/40"
                  : "bg-surface-soft text-ink-muted line-through ring-1 ring-line",
                canEdit
                  ? "active:scale-[0.98]"
                  : "cursor-not-allowed opacity-60",
              ].join(" ")}
              onClick={() =>
                onToggle(m.id, inSplit ? "exclude" : "include")
              }
            >
              {m.displayName}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
