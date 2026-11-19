"use client";

import { TopAppBar } from "@/components/ui/TopAppBar";
import { BottomNav } from "@/components/ui/BottomNav";
import { ProfileTopButton } from "@/components/ui/ProfileTopButton";

interface MobileShellProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  backHref?: string;
  rightSlot?: React.ReactNode;
  showAppBar?: boolean;
  showBottomNav?: boolean;
  /** 상단 바 우측 내 정보. 기본 on */
  showProfile?: boolean;
}

/** 떠 있는 하단 네비(56px) + 하단 여백 + safe-area */
const BOTTOM_NAV_PADDING =
  "pb-[calc(5.25rem+env(safe-area-inset-bottom))]";

/**
 * 화면 공통 셸.
 * TopAppBar + 스크롤 콘텐츠 + BottomNav를 조합한다.
 */
export function MobileShell({
  children,
  title,
  showBack = false,
  onBack,
  backHref = "/",
  rightSlot,
  showAppBar = true,
  showBottomNav = true,
  showProfile = true,
}: MobileShellProps) {
  const appBarRight =
    rightSlot || showProfile ? (
      <>
        {rightSlot}
        {showProfile ? <ProfileTopButton /> : null}
      </>
    ) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showAppBar && (
        <TopAppBar
          title={title}
          showBack={showBack}
          onBack={onBack}
          backHref={backHref}
          rightSlot={appBarRight}
        />
      )}

      <main
        className={`relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain ${
          showBottomNav ? BOTTOM_NAV_PADDING : ""
        }`}
      >
        {children}
      </main>

      {showBottomNav && <BottomNav />}
    </div>
  );
}
