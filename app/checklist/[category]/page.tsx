import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  CHECKLIST_CATEGORIES,
  getChecklistCategory,
} from "@/lib/checklist/categories";
import { FlightChecklistContent } from "@/components/checklist/FlightChecklistContent";
import { HotelChecklistContent } from "@/components/checklist/HotelChecklistContent";
import { DocsChecklistContent } from "@/components/checklist/DocsChecklistContent";

interface ChecklistCategoryPageProps {
  params: Promise<{ category: string }>;
}

export function generateStaticParams() {
  return CHECKLIST_CATEGORIES.map((item) => ({ category: item.id }));
}

export default async function ChecklistCategoryPage({
  params,
}: ChecklistCategoryPageProps) {
  const { category } = await params;
  const item = getChecklistCategory(category);

  if (!item) {
    return (
      <MobileShell title="체크리스트" showBack backHref="/" showBottomNav={false}>
        <div className="flex flex-col items-center gap-4 px-5 py-20 text-center">
          <p className="text-base font-bold text-ink-heading">
            카테고리를 찾을 수 없어요
          </p>
          <Link href="/">
            <PrimaryButton fullWidth={false} className="px-6">
              홈으로 돌아가기
            </PrimaryButton>
          </Link>
        </div>
      </MobileShell>
    );
  }

  if (item.id === "hotel") {
    return (
      <MobileShell title={item.label} showBack backHref="/" showBottomNav={false}>
        <HotelChecklistContent />
      </MobileShell>
    );
  }

  if (item.id === "flight") {
    return (
      <MobileShell title={item.label} showBack backHref="/" showBottomNav={false}>
        <FlightChecklistContent />
      </MobileShell>
    );
  }

  if (item.id === "docs") {
    return (
      <MobileShell title={item.label} showBack backHref="/" showBottomNav={false}>
        <DocsChecklistContent />
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title={item.label}
      showBack
      backHref="/"
      showBottomNav={false}
    >
      <div className="flex flex-col gap-5 px-5 pb-10 pt-5">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight text-ink-heading">
            {item.label} 체크리스트
          </h2>
          <p className="text-sm leading-6 text-ink-body">{item.description}</p>
        </header>

        <section className="rounded-xl2 border border-dashed border-line-soft bg-surface-white px-4 py-10 text-center shadow-soft">
          <p className="text-sm font-semibold text-ink-heading">
            곧 내용을 채워 넣을 예정이에요
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-caption">
            이 화면에 {item.label} 관련 체크 항목을 추가하면 됩니다.
          </p>
        </section>
      </div>
    </MobileShell>
  );
}
