"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { PasteExpenseBox } from "@/components/ledger/PasteExpenseBox";
import { ReceiptUploader } from "@/components/ledger/ReceiptUploader";
import { VoiceInputButton } from "@/components/ledger/VoiceInputButton";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";

type Props = {
  tripId: string;
  inboxCount: number;
  cancelNotice: ExpenseDraftInput | null;
  onDismissCancel: () => void;
  onCancelNotice: (draft: ExpenseDraftInput) => void;
  onManual: () => void;
  onDrafts: (drafts: ExpenseDraftInput[]) => void;
  receiptRef: RefObject<HTMLDivElement | null>;
  voiceRef: RefObject<HTMLDivElement | null>;
  /** 통계 카드 (LedgerDashboard) */
  dashboard: React.ReactNode;
  /** 지출 목록 */
  expenseList: React.ReactNode;
};

/** 호스트 ③ 기록 단계. */
export function RecordStep({
  tripId,
  inboxCount,
  cancelNotice,
  onDismissCancel,
  onCancelNotice,
  onManual,
  onDrafts,
  receiptRef,
  voiceRef,
  dashboard,
  expenseList,
}: Props) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-[44px] rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"
          onClick={onManual}
        >
          직접 입력
        </button>
      </div>

      <PasteExpenseBox
        tripId={tripId}
        onDrafts={onDrafts}
        onCancelNotice={onCancelNotice}
      />
      <div ref={receiptRef}>
        <ReceiptUploader tripId={tripId} onDraft={(d) => onDrafts([d])} />
      </div>
      <div ref={voiceRef}>
        <VoiceInputButton tripId={tripId} onDrafts={onDrafts} />
      </div>

      {dashboard}

      <div className="flex flex-wrap gap-3 text-xs font-bold text-brand">
        <Link href={`/trips/${tripId}/ledger/inbox`}>
          인박스{inboxCount > 0 ? ` (${inboxCount})` : ""}
        </Link>
        <Link href={`/trips/${tripId}/ledger/connect`}>자동 수집</Link>
        <Link href={`/trips/${tripId}/ledger/settle`}>정산</Link>
        <Link href={`/trips/${tripId}/ledger/report`}>리포트</Link>
      </div>

      {cancelNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
          <p className="font-bold text-amber-900">취소 문자예요</p>
          <p className="text-amber-800">
            {cancelNotice.merchant ?? "가맹점"} · {cancelNotice.amount}{" "}
            {cancelNotice.currency}
          </p>
          <button
            type="button"
            className="mt-1 min-h-[44px] font-bold text-amber-900 underline"
            onClick={onDismissCancel}
          >
            닫기
          </button>
        </div>
      ) : null}

      {expenseList}
    </>
  );
}
