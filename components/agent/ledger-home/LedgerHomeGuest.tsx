import Link from "next/link";
import { Wallet } from "lucide-react";

/** 게스트: 데이터 섹션 대신 로그인 유도. */
export function LedgerHomeGuest() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl bg-surface-white px-4 py-8 text-center shadow-soft ring-1 ring-line-soft">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft">
        <Wallet className="h-6 w-6 text-brand" aria-hidden />
      </span>
      <h2 className="text-lg font-extrabold text-ink-heading">
        로그인하면 가계부를 쓸 수 있어요
      </h2>
      <Link
        href="/login?next=/agent"
        className="inline-flex min-h-touch items-center justify-center rounded-xl bg-brand px-6 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        로그인하기
      </Link>
    </section>
  );
}
