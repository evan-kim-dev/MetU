"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LedgerTab } from "@/components/trips/ledger/LedgerTab";
import type { ExpenseDraft } from "@/components/trips/ledger/ExpenseForm";
import type { ExpenseParseItemOut } from "@/lib/ai/contracts";
import { useLedger } from "@/lib/ledger/useLedger";
import { useTrips } from "@/lib/trips/TripProvider";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  MapPin,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { DestinationImage } from "@/components/ui/DestinationImage";
import { BudgetDonutChart } from "@/components/recommend/BudgetDonutChart";
import {
  TripExpenseEditor,
  TripIconButton,
  TripInfoCard,
} from "@/components/trips/TripDetailParts";
import { ItineraryChatBar } from "@/components/trips/ItineraryChatBar";
import { TripMapPanel } from "@/components/trips/TripMapPanel";
import { useTripDetailEditor } from "@/components/trips/useTripDetailEditor";
import type { MapPoint } from "@/lib/map/trip-points";
import { formatKRW } from "@/lib/shared/format";
import { computeTripDDay, formatTripDDayLabel } from "@/lib/trips/d-day";

const SortableDayList = dynamic(
  () =>
    import("@/components/trips/SortableDayList").then((m) => m.SortableDayList),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-32 w-full animate-pulse rounded-2xl bg-surface-soft"
        aria-hidden
      />
    ),
  }
);

interface TripDetailContentProps {
  tripId: string;
}

type DetailTab = "schedule" | "ledger";

export function TripDetailContent({ tripId }: TripDetailContentProps) {
  const router = useRouter();
  const { user, provider } = useAuth();
  const { updateTrip } = useTrips();
  const isGuest = !user || provider === "guest";
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
        <div className="flex flex-col gap-4 px-5 pt-5" aria-busy="true" aria-label="불러오는 중">
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
        {/* 히어로 */}
        <div className="relative h-56 overflow-hidden rounded-2xl bg-surface-soft shadow-md">
          <DestinationImage
            destination={trip.destination}
            country={trip.country}
            storedUrl={trip.imageUrl}
            alt={`${trip.destination} 여행`}
            sizes="440px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-surface-white">
            <div className="flex items-center gap-1 text-xs font-semibold opacity-90">
              <MapPin className="h-3.5 w-3.5" />
              {trip.country}
            </div>
            <h2 className="mt-1 text-3xl font-extrabold">{trip.destination}</h2>
            <div className="mt-1 flex items-center gap-1 text-sm opacity-90">
              <CalendarDays className="h-4 w-4" />
              {trip.dateRange}
            </div>
          </div>
          <span className="absolute right-3 top-3 rounded-full bg-surface-white/90 px-3 py-1 text-xs font-extrabold text-brand-strong">
            {trip.status === "upcoming"
              ? formatTripDDayLabel(
                  computeTripDDay(trip.dateRange, trip.dDay)
                )
              : trip.status === "ongoing"
                ? "진행 중"
                : "완료"}
          </span>
        </div>

        {/* 요약 정보 */}
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

        {/* 예산 */}
        <section className="rounded-2xl border-0 bg-surface-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand" />
              <h3 className="text-lg font-extrabold text-ink-heading">예산</h3>
            </div>
            {canEdit && editSection !== "budget" && (
              <TripIconButton label="예산 수정" onClick={openBudgetEdit}>
                <Pencil className="h-4 w-4" strokeWidth={2.2} />
              </TripIconButton>
            )}
          </div>

          {editSection === "budget" ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink-caption">
                  총 예산
                </span>
                <input
                  inputMode="numeric"
                  value={draftBudget}
                  onChange={(e) =>
                    setDraftBudget(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="h-11 rounded-xl border border-brand bg-surface-white px-3 text-sm font-bold text-ink-heading focus:outline-none focus:ring-4 focus:ring-brand/10"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditSection(null)}
                  className="flex-1 rounded-xl border border-line-muted py-2.5 text-sm font-bold text-ink-body"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveBudget}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-surface-white"
                >
                  <Check className="h-4 w-4" />
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs font-medium text-ink-caption">
                      남은 예산
                    </p>
                    <p className="text-2xl font-extrabold text-ink-heading">
                      {formatKRW(remaining)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-brand">
                    {usedPercent}% 사용
                  </p>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-soft">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.min(usedPercent, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-ink-caption">
                  총 {formatKRW(trip.budget)} 중 {formatKRW(trip.spent)} 사용
                </p>
              </div>

              {trip.budgetAllocation && trip.budgetAllocation.length > 0 && (
                <div className="border-t border-line-soft pt-5">
                  <BudgetDonutChart
                    items={trip.budgetAllocation}
                    totalBudget={trip.budget}
                    people={trip.people}
                  />
                </div>
              )}
            </div>
          )}
        </section>

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
            canInvite={canEdit}
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
            onAddMember={canEdit ? ledger.addMember : undefined}
            onRemoveMember={canEdit ? ledger.removeMember : undefined}
            onDeleteExpense={ledger.removeExpense}
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

        {(isGuest || detailTab === "schedule") &&
        trip.dailySchedule &&
        trip.dailySchedule.length > 0 ? (
          <TripMapPanel
            days={trip.dailySchedule}
            country={trip.country}
            destination={trip.destination}
            spendByPlaceId={
              !isGuest ? ledger.spendByPlaceId : undefined
            }
            highlightKey={mapHighlightKey}
            onSelectPoint={handleSelectMapPoint}
          />
        ) : null}

        {/* AI 일정표 */}
        {(isGuest || detailTab === "schedule") &&
        trip.dailySchedule &&
        trip.dailySchedule.length > 0 ? (
          <section className="rounded-2xl border-0 bg-surface-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-brand" />
                <h3 className="text-lg font-extrabold text-ink-heading">일정표</h3>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setReorderMode((v) => !v);
                    setReorderError("");
                    cancelDayEdit();
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    reorderMode
                      ? "bg-brand text-white"
                      : "bg-surface-soft text-ink-body"
                  }`}
                >
                  {reorderMode ? "순서 바꾸기 종료" : "순서 바꾸기"}
                </button>
              ) : null}
            </div>

            {reorderError ? (
              <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                {reorderError}
              </p>
            ) : null}

            {canEdit && !reorderMode && trip.dailySchedule ? (
              <ItineraryChatBar
                city={trip.destination}
                country={trip.country}
                styles={trip.styles}
                nights={Math.max(1, trip.dailySchedule.length - 1)}
                dailySchedule={trip.dailySchedule}
                onScheduleChange={(next) => updateTripSchedule(next)}
              />
            ) : null}

            {reorderMode ? (
              <SortableDayList
                days={trip.dailySchedule ?? []}
                onReorder={(from, to) => {
                  void (async () => {
                    const ok = await applyScheduleReorder(from, to);
                    if (!ok) {
                      setReorderError("순서를 바꾸지 못했어요.");
                    } else {
                      setReorderError("");
                    }
                  })();
                }}
              />
            ) : (
            <div className="flex flex-col gap-4">
              {(trip.dailySchedule ?? []).map((day, dayIndex) => {
                const isEditing = editingDayIndex === dayIndex && draftDay;

                return (
                  <div
                    key={day.day}
                    className="rounded-2xl border-0 bg-surface-soft shadow-sm p-4"
                  >
                    {isEditing ? (
                      <>
                        <div className="mb-3">
                          <span className="text-sm font-extrabold text-brand">
                            {draftDay.day}일차
                          </span>
                        </div>

                        <div className="flex flex-col gap-3">
                          {draftDay.items.map((item, itemIndex) => (
                            <div
                              key={`edit-${draftDay.day}-${itemIndex}`}
                              className="rounded-lg border border-line-soft bg-surface-white p-3"
                            >
                              <div className="mb-2 flex items-center gap-2">
                                <input
                                  value={item.time}
                                  onChange={(e) =>
                                    updateDraftItem(itemIndex, {
                                      time: e.target.value,
                                    })
                                  }
                                  onBlur={sortDraftDayByTime}
                                  placeholder="14:00"
                                  className="h-9 w-20 rounded-lg border border-line-muted px-2 text-xs font-semibold text-ink-caption focus:border-brand focus:outline-none"
                                />
                                <input
                                  inputMode="numeric"
                                  value={item.cost > 0 ? String(item.cost) : ""}
                                  onChange={(e) =>
                                    updateDraftItem(itemIndex, {
                                      cost: e.target.value.replace(/[^0-9]/g, ""),
                                    })
                                  }
                                  placeholder="금액"
                                  className="h-9 min-w-0 flex-1 rounded-lg border border-line-muted px-2 text-xs font-bold text-ink-heading focus:border-brand focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeDraftItem(itemIndex)}
                                  aria-label="일정 항목 삭제"
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-danger active:bg-danger/10"
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                                </button>
                              </div>
                              <input
                                value={item.title}
                                onChange={(e) =>
                                  updateDraftItem(itemIndex, {
                                    title: e.target.value,
                                  })
                                }
                                placeholder="소제목 예: 지하철 → 오테마치역"
                                className="h-9 w-full rounded-lg border border-line-muted px-2.5 text-sm font-semibold text-ink-heading focus:border-brand focus:outline-none"
                              />
                              <input
                                value={item.detail ?? ""}
                                onChange={(e) =>
                                  updateDraftItem(itemIndex, {
                                    detail: e.target.value,
                                  })
                                }
                                placeholder="내용 예: 역에서 황거동 어원 입구로 이동"
                                className="mt-2 h-9 w-full rounded-lg border border-line-muted px-2.5 text-sm text-ink-body focus:border-brand focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={addDraftItem}
                          className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                          일정 추가
                        </button>

                        <p className="mt-3 border-t border-line-soft pt-2 text-right text-xs font-bold text-brand">
                          일일 예상 {formatKRW(draftDay.dayTotal)}
                        </p>

                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={cancelDayEdit}
                            className="flex-1 rounded-xl border border-line-muted py-2.5 text-sm font-bold text-ink-body"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={() => saveDayEdit(dayIndex)}
                            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-surface-white"
                          >
                            <Check className="h-4 w-4" />
                            저장
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-brand">
                            {day.day}일차
                          </span>
                          {canEdit ? (
                            <TripIconButton
                              label={`${day.day}일차 일정 수정`}
                              onClick={() => openDayEdit(dayIndex)}
                            >
                              <Pencil className="h-4 w-4" strokeWidth={2.2} />
                            </TripIconButton>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2">
                          {day.items.map((item, itemIndex) => {
                            const pointKey = `${day.day}-${itemIndex}`;
                            const highlighted = mapHighlightKey === pointKey;
                            return (
                              <div
                                key={pointKey}
                                ref={(el) => {
                                  scheduleItemRefs.current[pointKey] = el;
                                }}
                                className={`flex items-start justify-between gap-3 rounded-lg px-1 py-1 transition ${
                                  highlighted ? "ring-2 ring-brand bg-brand/5" : ""
                                }`}
                              >
                                <div>
                                  <p className="text-xs font-semibold text-ink-caption">
                                    {item.time}
                                  </p>
                                  <p className="text-sm font-bold text-ink-heading">
                                    {item.title}
                                  </p>
                                  {item.detail ? (
                                    <p className="mt-0.5 text-sm leading-snug text-ink-body">
                                      {item.detail}
                                    </p>
                                  ) : null}
                                  {typeof item.travelFromPrevMin === "number" &&
                                  item.travelFromPrevMin > 0 ? (
                                    <p className="mt-0.5 text-[11px] font-semibold text-brand">
                                      이동 {item.travelFromPrevMin}분
                                    </p>
                                  ) : null}
                                  {item.hoursKnown === false ? (
                                    <p className="mt-0.5 text-[11px] text-ink-caption">
                                      영업시간 확인 필요
                                      {item.detailUrl ? (
                                        <>
                                          {" · "}
                                          <a
                                            href={item.detailUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="underline"
                                          >
                                            지도에서 보기
                                          </a>
                                        </>
                                      ) : null}
                                    </p>
                                  ) : null}
                                  {item.warnings?.includes("closed") ? (
                                    <p className="mt-0.5 text-[11px] font-semibold text-danger">
                                      영업시간 확인 필요
                                    </p>
                                  ) : null}
                                </div>
                                {item.cost > 0 ? (
                                  <span className="shrink-0 text-xs font-bold text-ink-heading">
                                    {formatKRW(item.cost)}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-3 border-t border-line-soft pt-2 text-right text-xs font-bold text-brand">
                          일일 예상 {formatKRW(day.dayTotal)}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </section>
        ) : null}

        {/* 여행 스타일 */}
        {styleLabels.length > 0 && (
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
        )}

        {/* 지출 내역 — 게스트는 JSON 로컬 방식 */}
        {isGuest ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-ink-heading">
              이전 방식 지출
            </h3>
            <button
              type="button"
              onClick={openExpenseAdd}
              className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              추가
            </button>
          </div>

          {editSection === "expense" && editingExpenseId === "new" && (
            <TripExpenseEditor
              form={expenseForm}
              onChange={setExpenseForm}
              onCancel={() => {
                setEditSection(null);
                setEditingExpenseId(null);
              }}
              onSave={saveExpense}
            />
          )}

          <div className="flex flex-col gap-2">
            {trip.expenses.length === 0 && editSection !== "expense" && (
              <p className="rounded-2xl border border-dashed border-line-muted px-4 py-6 text-center text-sm text-ink-caption">
                아직 지출 내역이 없어요
              </p>
            )}

            {trip.expenses.map((expense) =>
              editSection === "expense" && editingExpenseId === expense.id ? (
                <TripExpenseEditor
                  key={expense.id}
                  form={expenseForm}
                  onChange={setExpenseForm}
                  onCancel={() => {
                    setEditSection(null);
                    setEditingExpenseId(null);
                  }}
                  onSave={saveExpense}
                  onDelete={() => deleteExpense(expense.id)}
                />
              ) : (
                <div
                  key={expense.id}
                  className="flex items-center gap-2 rounded-2xl border border-line-soft bg-surface-white px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink-heading">
                      {expense.label}
                    </p>
                    <p className="text-xs text-ink-caption">
                      {expense.category} · {expense.date}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-ink-heading">
                    {formatKRW(expense.amount)}
                  </span>
                  <TripIconButton
                    label={`${expense.label} 수정`}
                    onClick={() => openExpenseEdit(expense)}
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2.2} />
                  </TripIconButton>
                </div>
              )
            )}
          </div>
        </section>
        ) : null}

        {/* 메모 */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-ink-heading">메모</h3>
            {canEdit && editSection !== "memo" && (
              <TripIconButton label="메모 수정" onClick={openMemoEdit}>
                <Pencil className="h-4 w-4" strokeWidth={2.2} />
              </TripIconButton>
            )}
          </div>

          {editSection === "memo" ? (
            <div className="flex flex-col gap-3">
              <textarea
                value={draftMemo}
                onChange={(e) => setDraftMemo(e.target.value)}
                rows={4}
                placeholder="여행 메모를 입력하세요"
                className="w-full resize-none rounded-2xl border border-brand bg-surface-white px-4 py-3 text-sm text-ink-heading focus:outline-none focus:ring-4 focus:ring-brand/10"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditSection(null)}
                  className="flex-1 rounded-xl border border-line-muted py-2.5 text-sm font-bold text-ink-body"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveMemo}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-surface-white"
                >
                  <Check className="h-4 w-4" />
                  저장
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-line-soft bg-surface-white px-4 py-3 text-sm leading-relaxed text-ink-body">
              {trip.memo?.trim()
                ? trip.memo
                : canEdit
                  ? "메모가 없어요. 연필 아이콘으로 추가하세요."
                  : "메모가 없어요."}
            </p>
          )}
        </section>

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
