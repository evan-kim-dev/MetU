"use client";

import { LoginMethodList } from "@/components/auth/LoginMethodList";

interface CommunityLoginGateProps {
  /** 예: 게시판, 멧톡 */
  featureName: string;
}

export function CommunityLoginGate({ featureName }: CommunityLoginGateProps) {
  return (
    <div className="w-full rounded-xl2 border border-line-soft bg-surface-white p-5 shadow-soft">
      <p className="text-center text-base font-bold text-ink-heading">
        로그인 후 이용해 주세요
      </p>
      <p className="mt-2 text-center text-sm leading-relaxed text-ink-caption">
        {featureName}은(는) 회원 로그인 후 이용할 수 있어요.
      </p>
      <LoginMethodList collapsible className="mt-5" />
    </div>
  );
}

interface CommunityGatedLayoutProps {
  featureName: string;
  children: React.ReactNode;
}

/**
 * 블러 처리된 목록 위에 로그인 카드를 겹친다.
 * absolute는 스크롤 영역(relative 부모) 기준이라 main 스크롤 시 함께 이동한다.
 */
export function CommunityGatedLayout({
  featureName,
  children,
}: CommunityGatedLayoutProps) {
  return (
    <div className="relative">
      <div
        className="pointer-events-none select-none blur-[6px] opacity-50"
        aria-hidden
      >
        {children}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[clamp(4.5rem,24vh,9rem)] z-10 px-5">
        <div className="pointer-events-auto mx-auto w-full max-w-sm">
          <CommunityLoginGate featureName={featureName} />
        </div>
      </div>
    </div>
  );
}
