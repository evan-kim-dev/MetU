import Image from "next/image";
import Link from "next/link";

type MetULogoVariant = "appbar" | "hero";

interface MetULogoProps {
  variant?: MetULogoVariant;
  /** hero 전용: 상단 AI 배지 노출 */
  showPlannerBadge?: boolean;
  className?: string;
}

/** 웹 상단·로그인 히어로 공통: 가로 워드마크 + 마스코트 (투명 배경). */
const LOCKUP_SRC = "/brand/metu-lockup.png";

export function MetULogo({
  variant = "appbar",
  showPlannerBadge = false,
  className = "",
}: MetULogoProps) {
  if (variant === "hero") {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        {/* 상단바와 같은 lockup (사각 아이콘 칩 없음) */}
        <Image
          src={LOCKUP_SRC}
          alt="MetU"
          width={280}
          height={112}
          priority
          className="h-10 w-auto max-w-[9.5rem] object-contain"
        />
        {showPlannerBadge ? (
          <span className="text-mu-caption font-medium text-mu-fg-3">
            AI 여행 플래너
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <Link
      href="/"
      aria-label="MetU 홈"
      className={`mu-focus inline-flex items-center ${className}`}
    >
      <Image
        src={LOCKUP_SRC}
        alt=""
        width={120}
        height={48}
        priority
        className="h-8 w-auto max-w-[8rem] object-contain object-left"
      />
    </Link>
  );
}
