"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";

type Props = {
  onCreate: () => void;
  /** 자동 기록이 꺼져 있으면 연결 안내 한 줄만 보여 줘요 */
  showConnectHint: boolean;
};

const LINK =
  "inline-flex min-h-tap items-center rounded-xl px-2 text-sm font-bold text-mu-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent";

/** 여행이 하나도 없을 때. */
export function LedgerHomeEmpty({ onCreate, showConnectHint }: Props) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl bg-mu-card px-4 py-8 text-center border border-mu-line">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mu-sunken">
        <Wallet className="h-6 w-6 text-mu-accent" aria-hidden />
      </span>
      <h2 className="text-lg font-extrabold text-mu-fg">
        여행을 만들면 가계부가 시작돼요
      </h2>
      <p className="text-sm text-mu-fg-2">
        여행을 하나 만들면 지출 기록과 정산을 한곳에서 볼 수 있어요
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex min-h-touch items-center justify-center rounded-xl bg-mu-accent px-6 text-sm font-bold text-mu-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent focus-visible:ring-offset-2"
      >
        빠르게 여행 만들기
      </button>
      <Link href="/onboarding" className={LINK}>
        AI로 일정까지 계획하기
      </Link>
      {showConnectHint ? (
        <p className="text-xs text-mu-fg-2">
          카드 알림을 연결하면 지출이 자동으로 기록돼요.{" "}
          <Link href="/onboarding/automation" className="font-bold text-mu-accent">
            연결하기
          </Link>
        </p>
      ) : null}
    </section>
  );
}
