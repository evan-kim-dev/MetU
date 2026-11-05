import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Plus, Zap } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionSkeleton } from "@/components/ui/PageSkeleton";
import { ActiveTripSection } from "@/components/home/ActiveTripSection";
import { AISmartTipsShortcut } from "@/components/home/AISmartTipsShortcut";
import { HomeGreeting } from "@/components/home/HomeGreeting";
import { HomeNotificationBell } from "@/components/home/HomeNotificationBell";
import { GuestHomeCard } from "@/components/home/GuestHomeCard";
import { FirstRunChecklist } from "@/components/home/FirstRunChecklist";
import { AutomationStatusBanner } from "@/components/home/AutomationStatusBanner";
import { UnassignedInboxBanner } from "@/components/home/UnassignedInboxBanner";
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

        <GuestHomeCard />
        <FirstRunChecklist />
        <AutomationStatusBanner />
        <UnassignedInboxBanner />

        {/* 새 여행 계획 CTA */}
        <div className="flex flex-col gap-2">
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
          <Link
            href="/onboarding/result?sample=tokyo"
            className="flex min-h-tap items-center justify-between rounded-xl2 border border-brand/30 bg-brand-soft/40 px-5 py-3 text-brand transition-all hover:bg-brand-soft/60 active:scale-[0.99]"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Zap
                className="h-4 w-4 shrink-0 text-brand"
                strokeWidth={2.4}
                aria-hidden
              />
              <span className="text-xs font-bold text-ink-heading">
                [1초 데모] 100만원 도쿄 2인 AI 추천 플랜 바로보기
              </span>
            </div>
            <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-brand">
              체험하기
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
            </span>
          </Link>
        </div>

        {/* 진행 중인 여행 */}
        <Suspense
          fallback={
            <SectionSkeleton title="진행·예정 여행" heightClass="h-52" />
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
          <SectionErrorBoundary fallbackTitle="추천 여행지를 불러오지 못했어요">
            <RecommendedGrid places={recommended} />
          </SectionErrorBoundary>
        </section>
      </div>
    </MobileShell>
  );
}
