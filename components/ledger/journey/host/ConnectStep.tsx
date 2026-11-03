"use client";

import Link from "next/link";

type Props = {
  tripId: string;
  /** "나중에 직접 입력할게요" — 초대 단계로 넘어가요. */
  onLater: () => void;
};

/** 호스트 ① 연결 단계. */
export function ConnectStep({ tripId, onLater }: Props) {
  return (
    <section className="rounded-2xl border border-line-soft bg-surface-white p-4">
      <h2 className="text-sm font-extrabold text-ink-heading">
        알림을 연결해요
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        결제 알림이 오면 지출이 자동으로 쌓여요
      </p>
      <Link
        href={`/trips/${tripId}/ledger/connect`}
        className="mt-3 inline-flex min-h-tap items-center text-sm font-bold text-brand"
      >
        연결 관리
      </Link>
      <button
        type="button"
        className="mt-2 block text-xs font-semibold text-ink-muted underline"
        onClick={onLater}
      >
        나중에 직접 입력할게요
      </button>
    </section>
  );
}
