import Link from "next/link";
import { Wallet } from "lucide-react";

/** 게스트: 데이터 섹션 대신 로그인 유도. */
export function LedgerHomeGuest() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl bg-mu-card px-4 py-8 text-center border border-mu-line">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mu-sunken">
        <Wallet className="h-6 w-6 text-mu-accent" aria-hidden />
      </span>
      <h2 className="text-lg font-extrabold text-mu-fg">
        로그인하면 가계부를 쓸 수 있어요
      </h2>
      <Link
        href="/login?next=/agent"
        className="inline-flex min-h-touch items-center justify-center rounded-xl bg-mu-accent px-6 text-sm font-bold text-mu-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent focus-visible:ring-offset-2"
      >
        로그인하기
      </Link>
    </section>
  );
}
