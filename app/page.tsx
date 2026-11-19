import { Suspense } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionSkeleton } from "@/components/ui/PageSkeleton";
import { ActiveTripSection } from "@/components/home/ActiveTripSection";
import { AISmartTipsShortcut } from "@/components/home/AISmartTipsShortcut";
import { HomeGreeting } from "@/components/home/HomeGreeting";
import { StartTripLink } from "@/components/home/StartTripLink";
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
    <MobileShell>
      <div className="flex flex-col gap-7 px-5 pb-2 pt-5">
        <section className="flex flex-col gap-2 animate-fade-up">
          <HomeGreeting />
          <h2 className="text-2xl font-extrabold leading-snug text-mu-fg">
            다음 여행은
            <br />
            <span className="text-mu-accent">어디로 떠날까요?</span>
          </h2>
        </section>

        <FirstRunChecklist />
        <AutomationStatusBanner />
        <UnassignedInboxBanner />

        <div className="flex flex-col gap-2">
          <StartTripLink />
        </div>

        <Suspense
          fallback={
            <SectionSkeleton title="진행·예정 여행" heightClass="h-52" />
          }
        >
          <SectionErrorBoundary fallbackTitle="여행 정보를 불러오지 못했어요">
            <ActiveTripSection />
          </SectionErrorBoundary>
        </Suspense>

        <AISmartTipsShortcut />

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
