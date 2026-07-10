import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <p className="text-[11px] font-bold tracking-[0.08em] text-brand">
        Met U
      </p>
      <h1 className="text-xl font-extrabold tracking-tight text-ink-heading">
        페이지를 찾을 수 없어요
      </h1>
      <p className="max-w-[280px] text-sm leading-relaxed text-ink-caption">
        주소가 바뀌었거나 잘못된 링크일 수 있어요.
      </p>
      <Link
        href="/"
        className="inline-flex h-13 min-h-[52px] w-full max-w-[280px] items-center justify-center rounded-2xl ai-gradient-bg px-6 text-base font-bold text-surface-white shadow-glow transition-all active:brightness-95"
      >
        홈으로 가기
      </Link>
    </div>
  );
}
