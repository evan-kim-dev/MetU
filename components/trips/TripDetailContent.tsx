"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LedgerTab } from "@/components/trips/ledger/LedgerTab";
import type { ExpenseDraft } from "@/components/trips/ledger/ExpenseForm";
import type { ExpenseParseItemOut } from "@/lib/ai/contracts";
import { useLedger } from "@/lib/ledger/useLedger";
import { useTrips } from "@/lib/trips/TripProvider";
import { useRouter } from "next/navigation";
import { Check, MapPin, Share2, Trash2, Users } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TripInfoCard } from "@/components/trips/TripDetailParts";
import { TripDetailBudgetSection } from "@/components/trips/detail/TripDetailBudgetSection";
import { TripDetailGuestExpenses } from "@/components/trips/detail/TripDetailGuestExpenses";
import { TripDetailHero } from "@/components/trips/detail/TripDetailHero";
import { TripDetailMemoSection } from "@/components/trips/detail/TripDetailMemoSection";
import { TripDetailScheduleSection } from "@/components/trips/detail/TripDetailScheduleSection";
import { TripDetailTipsSection } from "@/components/trips/detail/TripDetailTipsSection";
import { useTripDetailEditor } from "@/components/trips/useTripDetailEditor";
import type { MapPoint } from "@/lib/map/trip-points";

interface TripDetailContentProps {
  tripId: string;
}

type DetailTab = "schedule" | "ledger";

export function TripDetailContent({ tripId }: TripDetailContentProps) {
  const router = useRouter();
  const { user, provider, isAnonymous } = useAuth();
  const { updateTrip } = useTrips();
  const isGuest = !user || provider === "guest";
  /** UI 숨김. 쓰기는 서버·RLS가 최종 방어. */
  const ledgerReadOnly = isAnonymous;
  const [detailTab, setDetailTab] = useState<DetailTab>("schedule");
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
    editingExpenseId,
    setEditingExpenseId,
    expenseForm,
    setExpenseForm,
    draftMemo,
    setDraftMemo,
    editingDayIndex,
    draftDay,
    openBudgetEdit,
    saveBudget,
    openExpenseEdit,
    openExpenseAdd,
    saveExpense,
    deleteExpense,
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
  const scheduleItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
        />

        {!isGuest ? (
          <div
            className="flex rounded-full bg-surface-soft p-1"
            role="tablist"
            aria-label="여행 상세 탭"
          >
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === "schedule"}
              onClick={() => setDetailTab("schedule")}
              className={`flex-1 rounded-full py-2 text-sm font-bold transition ${
                detailTab === "schedule"
                  ? "bg-surface-white text-brand shadow-sm"
                  : "text-ink-body"
              }`}
            >
              일정
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === "ledger"}
              onClick={() => setDetailTab("ledger")}
              className={`flex-1 rounded-full py-2 text-sm font-bold transition ${
                detailTab === "ledger"
                  ? "bg-surface-white text-brand shadow-sm"
                  : "text-ink-body"
              }`}
            >
              가계부
            </button>
          </div>
        ) : null}

        {!isGuest && detailTab === "ledger" ? (
          <LedgerTab
            tripId={tripId}
            readOnly={ledgerReadOnly}
            canInvite={canEdit && !ledgerReadOnly}
            loading={ledger.loading}
            error={ledger.error}
            members={ledger.members}
            expenses={ledger.expenses}
            totalKrw={ledger.totalKrw}
            defaultCurrency={ledger.defaultCurrency}
            placeOptions={ledger.placeOptions}
            meId={
              ledger.members.find((m) => user?.id && m.userId === user.id)?.id ??
              ledger.members.find((m) => m.isOwner)?.id ??
              ledger.members[0]?.id
            }
            settlement={ledger.settlement}
            onAddMember={
              canEdit && !ledgerReadOnly ? ledger.addMember : undefined
            }
            onRemoveMember={
              canEdit && !ledgerReadOnly ? ledger.removeMember : undefined
            }
            onDeleteExpense={
              ledgerReadOnly ? undefined : ledger.removeExpense
            }
            onExpenseFxChanged={() => void ledger.reload()}
            onSaveExpense={async (
              draft: ExpenseDraft,
              expenseId?: string,
              parseMeta?: ExpenseParseItemOut
            ) => {
              const participantIds =
                parseMeta?.participantIds && parseMeta.participantIds.length > 0
                  ? parseMeta.participantIds
                  : null;
              const upsert = await ledger.buildUpsertFromAmount({
                paidBy: draft.paidBy,
                label: draft.label.trim(),
                category: draft.category,
                amount: Number(draft.amount),
                currency: draft.currency,
                placeId: draft.placeId || null,
                spentOn: draft.spentOn || null,
                dayIndex: draft.dayIndex ? Number(draft.dayIndex) : null,
                participantIds,
              });
              if (!upsert) return false;
              const row = await ledger.saveExpense(upsert, expenseId);
              return Boolean(row);
            }}
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

        {isGuest ? (
          <TripDetailGuestExpenses
            expenses={trip.expenses}
            editSection={editSection}
            editingExpenseId={editingExpenseId}
            expenseForm={expenseForm}
            setExpenseForm={setExpenseForm}
            openExpenseAdd={openExpenseAdd}
            openExpenseEdit={openExpenseEdit}
            saveExpense={saveExpense}
            deleteExpense={deleteExpense}
            setEditSection={setEditSection}
            setEditingExpenseId={setEditingExpenseId}
          />
        ) : null}

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
    </MobileShell>
  );
}
