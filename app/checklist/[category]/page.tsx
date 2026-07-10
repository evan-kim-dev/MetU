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
import { WeatherChecklistContent } from "@/components/checklist/WeatherChecklistContent";

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

  switch (item.id) {
    case "hotel":
      return (
        <MobileShell title={item.label} showBack backHref="/" showBottomNav={false}>
          <HotelChecklistContent />
        </MobileShell>
      );
    case "flight":
      return (
        <MobileShell title={item.label} showBack backHref="/" showBottomNav={false}>
          <FlightChecklistContent />
        </MobileShell>
      );
    case "docs":
      return (
        <MobileShell title={item.label} showBack backHref="/" showBottomNav={false}>
          <DocsChecklistContent />
        </MobileShell>
      );
    case "weather":
      return (
        <MobileShell title={item.label} showBack backHref="/" showBottomNav={false}>
          <WeatherChecklistContent />
        </MobileShell>
      );
  }
}
