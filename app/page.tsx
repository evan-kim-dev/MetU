import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionSkeleton } from "@/components/ui/PageSkeleton";
import { ActiveTripSection } from "@/components/home/ActiveTripSection";
import { AISmartTipsShortcut } from "@/components/home/AISmartTipsShortcut";
import { HomeGreeting } from "@/components/home/HomeGreeting";
import { HomeNotificationBell } from "@/components/home/HomeNotificationBell";
import { ActiveTripSmartTips } from "@/components/home/ActiveTripSmartTips";
import { RecommendedGrid } from "@/components/home/RecommendedGrid";
import { SectionErrorBoundary } from "@/components/ui/SectionErrorBoundary";
import { loadHomeData } from "@/lib/mock/loaders";

export const dynamic = "force-dynamic";

/** Screen 3: 홈 대시보드 */
export default async function HomePage() {
  const { recommended } = await loadHomeData();

  return (
    <MobileShell rightSlot={<HomeNotificationBell />}>
      <div className="flex flex-col gap-7 px-5 pb-2 pt-5">
        {/* Hero */}
        <section className="flex flex-col gap-2 animate-fade-up">
          <HomeGreeting />
          <h2 className="text-2xl font-extrabold leading-snug text-ink-heading">
            다음 여행은
            <br />
            <span className="ai-gradient-text">어디로 떠날까요?</span>
          </h2>
        </section>

        {/* 새 여행 계획 CTA */}
        <Link
          href="/onboarding"
          className="ai-gradient-bg flex items-center justify-between rounded-xl2 px-5 py-4 shadow-glow transition-all active:scale-[0.99]"
        >
          <div className="flex flex-col">
            <span className="text-sm font-bold text-surface-white">
              새로운 여행 계획하기
            </span>
            <span className="text-xs font-medium text-surface-white/80">
              예산만 알려주면 AI가 코스를 짜드려요
            </span>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-white/90">
            <Plus className="h-5 w-5 text-brand" strokeWidth={2.6} />
          </span>
        </Link>

        {/* 진행 중인 여행 */}
        <Suspense
          fallback={
            <SectionSkeleton title="계획 중인 여행" heightClass="h-52" />
          }
        >
          <SectionErrorBoundary fallbackTitle="여행 정보를 불러오지 못했어요">
            <ActiveTripSection />
          </SectionErrorBoundary>
        </Suspense>

        {/* AI Smart Tips (퀵 액션) */}
        <AISmartTipsShortcut />

        {/* AI Tip (진행 중인 여행 기준) */}
        <Suspense
          fallback={
            <section className="flex flex-col gap-3">
              <SectionSkeleton heightClass="h-28" />
            </section>
          }
        >
          <SectionErrorBoundary fallbackTitle="AI Tip을 불러오지 못했어요">
            <section className="flex flex-col gap-3">
              <ActiveTripSmartTips />
            </section>
          </SectionErrorBoundary>
        </Suspense>

        {/* AI 예산별 추천 */}
        <section className="flex flex-col gap-3">
          <SectionHeader title="AI 추천 여행지" ai />
          <RecommendedGrid places={recommended} />
        </section>
      </div>
    </MobileShell>
  );
}
