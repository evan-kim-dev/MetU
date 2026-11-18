import Image from "next/image";
import Link from "next/link";

type MetULogoVariant = "appbar" | "hero";

interface MetULogoProps {
  variant?: MetULogoVariant;
  /** hero 전용: 상단 AI 배지 노출 */
  showPlannerBadge?: boolean;
  className?: string;
}

/** 앱 아이콘 (파비콘·PWA·로그인 히어로). */
const ICON_SRC = "/brand/metu-icon.png";
/** 웹 상단 가로 워드마크 + 마스코트 (검은 배경용 흰 글자). */
const LOCKUP_SRC = "/brand/metu-lockup.png";

export function MetULogo({
  variant = "appbar",
  showPlannerBadge = false,
  className = "",
}: MetULogoProps) {
  if (variant === "hero") {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        {showPlannerBadge ? (
          <span className="rounded-full border border-mu-line bg-mu-accent-soft px-3 py-1 text-xs font-bold text-mu-accent">
            AI 여행 플래너
          </span>
        ) : null}
        <Image
          src={ICON_SRC}
          alt="MetU"
          width={128}
          height={128}
          priority
          className="h-28 w-28 rounded-[1.75rem] shadow-soft"
        />
      </div>
    );
  }

  // 흰 글자 락업 → 컴팩트 다크 칩. 탭하면 홈.
  return (
    <Link
      href="/"
      aria-label="MetU 홈"
      className={`mu-focus inline-flex items-center rounded-mu-md bg-mu-fg px-2 py-0.5 ${className}`}
    >
      <Image
        src={LOCKUP_SRC}
        alt=""
        width={120}
        height={48}
        priority
        className="h-7 w-auto max-w-[7.25rem] object-contain object-left"
      />
    </Link>
  );
}
