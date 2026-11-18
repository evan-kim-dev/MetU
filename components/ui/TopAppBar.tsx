"use client";

import { ChevronLeft } from "lucide-react";
import { useGoBack } from "@/lib/navigation/useGoBack";
import { MetULogo } from "@/components/ui/MetULogo";

interface TopAppBarProps {
  /** 중앙에 표시할 화면 타이틀. 없으면 왼쪽 로고를 표시한다. */
  title?: string;
  /** 뒤로가기 버튼 노출 여부 */
  showBack?: boolean;
  /** 커스텀 뒤로가기 핸들러 (없으면 backHref / 히스토리 기반 이동) */
  onBack?: () => void;
  /** 히스토리가 없을 때 이동할 경로 */
  backHref?: string;
  /** 우측 액션 영역 (확인함 등) */
  rightSlot?: React.ReactNode;
}

/**
 * 상단 앱바. 로고는 왼쪽, 액션은 오른쪽 (Toss식).
 */
export function TopAppBar({
  title,
  showBack = false,
  onBack,
  backHref = "/",
  rightSlot,
}: TopAppBarProps) {
  const goBack = useGoBack(backHref);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    goBack();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-mu-line bg-mu-card/80 backdrop-blur-md">
      <div className="flex h-14 items-center gap-1 px-3">
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          {showBack ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="뒤로 가기"
              className="mu-focus relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-mu-md text-mu-fg transition-colors active:bg-mu-sunken"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
            </button>
          ) : null}
          {title ? (
            <h1 className="min-w-0 truncate pl-1 text-mu-body font-bold text-mu-fg">
              {title}
            </h1>
          ) : (
            <MetULogo variant="appbar" />
          )}
        </div>

        <div className="relative z-10 flex shrink-0 items-center justify-end gap-0.5">
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
