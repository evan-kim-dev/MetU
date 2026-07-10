"use client";



import { ChevronLeft } from "lucide-react";
import { useGoBack } from "@/lib/navigation/useGoBack";
import { MetULogo } from "@/components/ui/MetULogo";



interface TopAppBarProps {

  /** 중앙에 표시할 화면 타이틀. 없으면 로고를 표시한다. */

  title?: string;

  /** 뒤로가기 버튼 노출 여부 */

  showBack?: boolean;

  /** 커스텀 뒤로가기 핸들러 (없으면 backHref / 히스토리 기반 이동) */

  onBack?: () => void;

  /** 히스토리가 없을 때 이동할 경로 */

  backHref?: string;

  /** 우측 액션 영역 (알림, 설정 등) */

  rightSlot?: React.ReactNode;

}



/**

 * 상단 앱바.

 * Glassmorphism(반투명 + blur) 배경으로 스크롤 시 콘텐츠 위에 부드럽게 겹쳐진다.

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

    <header className="sticky top-0 z-40 w-full border-b border-line-soft/60 bg-surface-white/80 backdrop-blur-md">

      <div className="flex h-14 items-center justify-between px-4">

        {/* 좌측: 뒤로가기 */}

        <div className="flex w-10 items-center justify-start">

          {showBack && (

            <button

              type="button"

              onClick={handleBack}

              aria-label="뒤로 가기"

              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-ink-heading transition-colors active:bg-surface-soft"

            >

              <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />

            </button>

          )}

        </div>



        {/* 중앙: 타이틀 또는 로고 */}

        <div className="flex min-w-0 flex-1 items-center justify-center px-2">

          {title ? (

            <h1 className="w-full truncate text-center text-base font-bold text-ink-heading">

              {title}

            </h1>

          ) : (
            <MetULogo variant="appbar" />
          )}

        </div>



        {/* 우측: 액션 슬롯 */}

        <div className="flex w-10 items-center justify-end">{rightSlot}</div>

      </div>

    </header>

  );

}

