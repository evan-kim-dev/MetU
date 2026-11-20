"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLedger } from "@/lib/ledger/useLedger";
import { useTrips } from "@/lib/trips/TripProvider";
import { useRouter } from "next/navigation";
import { Check, MapPin, Plus, Share2, Trash2, Users } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TripBotSheet } from "@/components/trips/TripBotSheet";
import { TripInfoCard } from "@/components/trips/TripDetailParts";
import {
  TripIntentSheet,
  type TripIntent,
} from "@/components/trips/TripIntentSheet";
import { ScheduleRebalanceSheet } from "@/components/trips/ScheduleRebalanceSheet";
import { TripDetailBudgetSection } from "@/components/trips/detail/TripDetailBudgetSection";
import { TripDetailHero } from "@/components/trips/detail/TripDetailHero";
import { TripDetailMemoSection } from "@/components/trips/detail/TripDetailMemoSection";
import { TripDetailScheduleSection } from "@/components/trips/detail/TripDetailScheduleSection";
import { TripDetailTipsSection } from "@/components/trips/detail/TripDetailTipsSection";
import { TripSummaryPanel } from "@/components/trips/detail/TripSummaryPanel";
import { useTripDetailEditor } from "@/components/trips/useTripDetailEditor";
import type { MapPoint } from "@/lib/map/trip-points";

interface TripDetailContentProps {
  tripId: string;
}

/** 일정·요약은 인페이지. 가계부·정산은 TripJourney(/ledger) 단일 쉘. */
type DetailTab = "summary" | "schedule";

type NavTab = DetailTab | "ledger" | "settle";

function nextScheduleLineFromTrip(trip: {
  dailySchedule?: Array<{
    dayLabel?: string;
    items?: Array<{ title?: string; placeName?: string }>;
  }>;
}): string | null {
  const days = trip.dailySchedule ?? [];
  for (const day of days) {
    const item = day.items?.[0];
    if (!item) continue;
    const place = item.placeName?.trim() || item.title?.trim();
    if (!place) continue;
    const dayLabel = day.dayLabel?.trim();
    return dayLabel ? `${dayLabel} · ${place}` : place;
  }
  return null;
}

export function TripDetailContent({ tripId }: TripDetailContentProps) {
  const router = useRouter();
  const { user, provider } = useAuth();
  const { updateTrip, afterJoinTrip } = useTrips();
  const isGuest = !user || provider === "guest";
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const scheduleSectionRef = useRef<HTMLDivElement>(null);
  const {
    trip,
    isReady,
    remaining,
    usedPercent,
    styleLabels,
    editSection,
    setEditSection,
    isDeleting,
    shareCopied,
    shareError,
    draftBudget,
    setDraftBudget,
    draftMemo,
    setDraftMemo,
    editingDayIndex,
    draftDay,
    openBudgetEdit,
    saveBudget,
    openMemoEdit,
    saveMemo,
    openDayEdit,
    cancelDayEdit,
    updateDraftItem,
    sortDraftDayByTime,
    addDraftItem,
    removeDraftItem,
    saveDayEdit,
    applyScheduleReorder,
    handleDelete,
    handleShareTrip,
    updateTripSchedule,
  } = useTripDetailEditor(tripId);

  // 초대로 합류한 여행(isOwner === false)은 읽기 전용이에요. 지출/송금만 함께 해요.
  const canEdit = trip?.isOwner !== false;

  const ledger = useLedger(tripId, {
    country: trip?.country,
    destination: trip?.destination,
    dailySchedule: trip?.dailySchedule,
    onTotalKrwChange: (totalKrw) => {
      if (trip && trip.isOwner !== false && trip.spent !== totalKrw) {
        void updateTrip(tripId, { spent: totalKrw });
      }
    },
  });

  const [mapHighlightKey, setMapHighlightKey] = useState<string | undefined>();
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderError, setReorderError] = useState("");
  const [intentOpen, setIntentOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const scheduleItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleTripIntent = useCallback(
    (intent: TripIntent) => {
      if (intent === "schedule") {
        setDetailTab("schedule");
        return;
      }
      if (intent === "expense") {
        router.push(`/trips/${tripId}/ledger?add=manual`);
        return;
      }
      if (intent === "split") {
        router.push(`/trips/${tripId}/ledger?step=adjust`);
        return;
      }
      if (intent === "cash") {
        router.push(`/trips/${tripId}/ledger?add=cash`);
        return;
      }
      if (intent === "bot") {
        setBotOpen(true);
      }
    },
    [router, tripId]
  );

  const handleSelectMapPoint = useCallback((point: MapPoint) => {
    setMapHighlightKey(point.key);
    const el = scheduleItemRefs.current[point.key];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setMapHighlightKey(undefined), 1800);
  }, []);

  const shareButton = (
    <button
      type="button"
      aria-label={shareCopied ? "링크 복사됨" : "여행 공유"}
      onClick={() => {
        void handleShareTrip();
      }}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-heading transition-colors active:bg-surface-soft"
    >
      {shareCopied ? (
        <Check className="h-5 w-5 text-brand" strokeWidth={2.2} />
      ) : (
        <Share2 className="h-5 w-5" strokeWidth={2} />
      )}
    </button>
  );

  if (!isReady) {
    return (
      <MobileShell title="여행 상세" showBack backHref="/trips">
        <div
          className="flex flex-col gap-4 px-5 pt-5"
          aria-busy="true"
          aria-label="불러오는 중"
        >
          <div className="h-52 animate-pulse rounded-xl2 bg-surface-soft" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 animate-pulse rounded-2xl bg-surface-soft" />
            <div className="h-20 animate-pulse rounded-2xl bg-surface-soft" />
          </div>
          <div className="h-36 animate-pulse rounded-2xl bg-surface-soft" />
        </div>
      </MobileShell>
    );
  }

  if (!trip) {
    return (
      <MobileShell title="여행 상세" showBack backHref="/trips">
        <div className="flex flex-col items-center gap-3 px-5 py-20 text-center">
          <p className="text-base font-bold text-ink-heading">
            여행을 찾을 수 없어요
          </p>
          <PrimaryButton onClick={() => router.push("/trips")}>
            내 여행 목록으로
          </PrimaryButton>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title="여행 상세"
      showBack
      backHref="/trips"
      rightSlot={canEdit ? shareButton : undefined}
    >
      {shareError ? (
        <p className="px-5 pt-3 text-xs text-red-500">{shareError}</p>
      ) : null}
      <div className="flex flex-col gap-6 px-5 pb-8 pt-5">
        <TripDetailHero trip={trip} />

        <section className="grid grid-cols-2 gap-3">
          <TripInfoCard
            icon={<Users className="h-4 w-4" />}
            label="인원"
            value={`${trip.people}명`}
          />
          <TripInfoCard
            icon={<MapPin className="h-4 w-4" />}
            label="출발지"
            value={trip.origin}
          />
        </section>

        <TripDetailBudgetSection
          trip={trip}
          canEdit={canEdit}
          remaining={remaining}
          usedPercent={usedPercent}
          editing={editSection === "budget"}
          draftBudget={draftBudget}
          setDraftBudget={setDraftBudget}
          onOpenEdit={openBudgetEdit}
          onCancel={() => setEditSection(null)}
          onSave={saveBudget}
          onReviewSchedule={() => {
            setDetailTab("schedule");
            if (canEdit && !isGuest) setRebalanceOpen(true);
            window.requestAnimationFrame(() => {
              scheduleSectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            });
          }}
        />

        <div
          ref={scheduleSectionRef}
          className="flex rounded-full bg-surface-soft p-1"
          role="tablist"
          aria-label="여행 상세 탭"
        >
          {(
            [
              ["summary", "요약"],
              ["schedule", "일정"],
              ["ledger", "가계부"],
              ["settle", "정산"],
            ] as const satisfies ReadonlyArray<readonly [NavTab, string]>
          ).map(([key, label]) => {
            const selected =
              key === "ledger" || key === "settle" ? false : detailTab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  if (key === "ledger") {
                    router.push(`/trips/${tripId}/ledger`);
                    return;
                  }
                  if (key === "settle") {
                    router.push(`/trips/${tripId}/ledger?step=settle`);
                    return;
                  }
                  setDetailTab(key);
                }}
                className={`min-h-tap flex-1 rounded-full px-1 py-2 text-xs font-bold transition sm:text-sm ${
                  selected
                    ? "bg-surface-white text-brand shadow-sm"
                    : "text-ink-body"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {detailTab === "summary" ? (
          <TripSummaryPanel
            tripId={tripId}
            nextScheduleLine={nextScheduleLineFromTrip(trip)}
            onOpenSchedule={() => setDetailTab("schedule")}
          />
        ) : null}

        <TripDetailScheduleSection
          trip={trip}
          canEdit={canEdit}
          isGuest={isGuest}
          detailTab={detailTab}
          spendByPlaceId={!isGuest ? ledger.spendByPlaceId : undefined}
          mapHighlightKey={mapHighlightKey}
          onSelectMapPoint={handleSelectMapPoint}
          scheduleItemRefs={scheduleItemRefs}
          reorderMode={reorderMode}
          setReorderMode={setReorderMode}
          reorderError={reorderError}
          setReorderError={setReorderError}
          cancelDayEdit={cancelDayEdit}
          updateTripSchedule={updateTripSchedule}
          applyScheduleReorder={applyScheduleReorder}
          editingDayIndex={editingDayIndex}
          draftDay={draftDay}
          openDayEdit={openDayEdit}
          updateDraftItem={updateDraftItem}
          sortDraftDayByTime={sortDraftDayByTime}
          removeDraftItem={removeDraftItem}
          addDraftItem={addDraftItem}
          saveDayEdit={saveDayEdit}
        />

        {styleLabels.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-extrabold text-ink-heading">
              여행 스타일
            </h3>
            <div className="flex flex-wrap gap-2">
              {styleLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-surface-soft px-3 py-1.5 text-sm font-semibold text-brand-strong"
                >
                  {label}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <TripDetailTipsSection tips={trip.tips ?? []} />

        <TripDetailMemoSection
          canEdit={canEdit}
          memo={trip.memo}
          editing={editSection === "memo"}
          draftMemo={draftMemo}
          setDraftMemo={setDraftMemo}
          onOpenEdit={openMemoEdit}
          onCancel={() => setEditSection(null)}
          onSave={saveMemo}
        />

        {canEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-bold text-red-600 transition-colors active:bg-red-100 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.2} />
            {isDeleting ? "삭제 중..." : "여행 삭제하기"}
          </button>
        ) : null}
      </div>

      {canEdit && !isGuest ? (
        <>
          <button
            type="button"
            aria-label="추가"
            onClick={() => setIntentOpen(true)}
            className="mu-focus fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[max(1rem,calc(50%-11rem))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-mu-accent text-mu-on-accent shadow-mu-float"
          >
            <Plus className="h-6 w-6" strokeWidth={2.2} aria-hidden />
          </button>
          <TripIntentSheet
            open={intentOpen}
            onClose={() => setIntentOpen(false)}
            onSelect={handleTripIntent}
          />
          <TripBotSheet
            tripId={tripId}
            open={botOpen}
            onClose={() => setBotOpen(false)}
          />
          <ScheduleRebalanceSheet
            open={rebalanceOpen}
            tripId={tripId}
            onClose={() => setRebalanceOpen(false)}
            onApplied={() => {
              void afterJoinTrip(tripId);
            }}
          />
        </>
      ) : null}
    </MobileShell>
  );
}
