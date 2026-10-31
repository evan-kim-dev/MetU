"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";

type Props = {
  onCreate: () => void;
  /** 자동 기록이 꺼져 있으면 연결 안내 한 줄만 보여 줘요 */
  showConnectHint: boolean;
};

const LINK =
  "inline-flex min-h-tap items-center rounded-xl px-2 text-sm font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/** 여행이 하나도 없을 때. */
export function LedgerHomeEmpty({ onCreate, showConnectHint }: Props) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl bg-surface-white px-4 py-8 text-center shadow-soft ring-1 ring-line-soft">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft">
        <Wallet className="h-6 w-6 text-brand" aria-hidden />
      </span>
      <h2 className="text-lg font-extrabold text-ink-heading">
        여행을 만들면 가계부가 시작돼요
      </h2>
      <p className="text-sm text-ink-body">
        여행을 하나 만들면 지출 기록과 정산을 한곳에서 볼 수 있어요
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex min-h-touch items-center justify-center rounded-xl bg-brand px-6 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        빠르게 여행 만들기
      </button>
      <Link href="/onboarding" className={LINK}>
        AI로 일정까지 계획하기
      </Link>
      {showConnectHint ? (
        <p className="text-xs text-ink-body">
          카드 알림을 연결하면 지출이 자동으로 기록돼요.{" "}
          <Link href="/onboarding/automation" className="font-bold text-brand">
            연결하기
          </Link>
        </p>
      ) : null}
    </section>
  );
}
