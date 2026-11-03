import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mu-root flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <p className="text-mu-caption font-bold text-mu-accent">Met U</p>
      <h1 className="text-mu-title font-extrabold tracking-tight text-mu-fg">
        페이지를 찾을 수 없어요
      </h1>
      <p className="max-w-copy text-mu-body leading-relaxed text-mu-fg-3">
        주소가 바뀌었거나 잘못된 링크일 수 있어요.
      </p>
      <Link
        href="/"
        className="mu-focus inline-flex h-14 min-h-touch w-full max-w-copy items-center justify-center rounded-mu-lg bg-mu-accent px-6 text-mu-body font-bold text-mu-on-accent transition-colors active:bg-mu-accent-strong"
      >
        홈으로 가기
      </Link>
    </div>
  );
}
