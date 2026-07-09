import { MobileShell } from "@/components/layout/MobileShell";
import type { LucideIcon } from "lucide-react";

interface PlaceholderScreenProps {
  title: string;
  icon: LucideIcon;
  description?: string;
}

/**
 * 아직 구현되지 않은 라우트를 위한 임시 화면.
 * 하단 네비게이션 링크가 404 없이 동작하도록 한다.
 */
export function PlaceholderScreen({
  title,
  icon: Icon,
  description = "곧 만나요! 이 화면은 준비 중이에요.",
}: PlaceholderScreenProps) {
  return (
    <MobileShell title={title}>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-soft text-brand">
          <Icon className="h-8 w-8" strokeWidth={2} />
        </div>
        <h2 className="text-lg font-bold text-ink-heading">{title}</h2>
        <p className="max-w-[260px] text-sm text-ink-caption">{description}</p>
      </div>
    </MobileShell>
  );
}
