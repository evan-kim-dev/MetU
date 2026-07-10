export type MetULogoVariant = "appbar" | "hero" | "compact";

interface MetULogoProps {
  variant?: MetULogoVariant;
  /** hero 전용: 상단 AI 배지 노출 */
  showPlannerBadge?: boolean;
  className?: string;
}

const GRADIENT_TEXT = "ai-gradient-text";

export function MetULogo({
  variant = "appbar",
  showPlannerBadge = false,
  className = "",
}: MetULogoProps) {
  if (variant === "hero") {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        {showPlannerBadge ? (
            <span className="ai-chip">AI 여행 플래너</span>
        ) : null}
        <LogoMark size="hero" />
      </div>
    );
  }

  return (
    <span className={className}>
      <LogoMark size={variant === "compact" ? "compact" : "appbar"} />
    </span>
  );
}

function LogoMark({ size }: { size: "hero" | "appbar" | "compact" }) {
  const textSize =
    size === "hero"
      ? "text-[40px] leading-none"
      : size === "appbar"
        ? "text-lg leading-none"
        : "text-sm leading-none";

  const aiSize =
    size === "hero"
      ? "px-1.5 py-0.5 text-[11px]"
      : size === "appbar"
        ? "px-1 py-px text-[9px]"
        : "px-1 py-px text-[8px]";

  return (
    <span className={`inline-flex items-center gap-1.5 ${textSize}`}>
      <span className={`font-extrabold tracking-tight ${GRADIENT_TEXT}`}>Met U</span>
      <span
        className={[
          "rounded-md border border-brand/20 bg-gradient-to-r from-brand/12 to-[#818CF8]/12 font-bold tracking-wider text-brand",
          aiSize,
        ].join(" ")}
      >
        AI
      </span>
    </span>
  );
}
