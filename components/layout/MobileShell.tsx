"use client";

import { TopAppBar } from "@/components/ui/TopAppBar";
import { BottomNav } from "@/components/ui/BottomNav";

interface MobileShellProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  backHref?: string;
  rightSlot?: React.ReactNode;
  showAppBar?: boolean;
  showBottomNav?: boolean;
}

/** 하단 네비 높이(72px) + 여유 공간 */
const BOTTOM_NAV_PADDING = "pb-[calc(4.5rem+env(safe-area-inset-bottom))]";

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
}: MobileShellProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {showAppBar && (
        <TopAppBar
          title={title}
          showBack={showBack}
          onBack={onBack}
          backHref={backHref}
          rightSlot={rightSlot}
        />
      )}

      <main
        className={`relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain ${
          showBottomNav ? BOTTOM_NAV_PADDING : ""
        } ${showBottomNav ? "ai-page-ambient" : ""}`}
      >
        {children}
      </main>

      {showBottomNav && <BottomNav />}
    </div>
  );
}
