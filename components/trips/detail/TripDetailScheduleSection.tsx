"use client";

import dynamic from "next/dynamic";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { CalendarDays, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { ItineraryChatBar } from "@/components/trips/ItineraryChatBar";
import { TripIconButton } from "@/components/trips/TripDetailParts";
import { TripMapPanel } from "@/components/trips/TripMapPanel";
import type { MapPoint } from "@/lib/map/trip-points";
import { formatKRW } from "@/lib/shared/format";
import type { Trip, TripDaySchedule } from "@/lib/trips/types";

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

export type TripDetailScheduleSectionProps = {
  trip: Trip;
  canEdit: boolean;
  isGuest: boolean;
  detailTab: "schedule" | "ledger";
  spendByPlaceId?: Record<string, number>;
  mapHighlightKey?: string;
  onSelectMapPoint: (point: MapPoint) => void;
  scheduleItemRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  reorderMode: boolean;
  setReorderMode: Dispatch<SetStateAction<boolean>>;
  reorderError: string;
  setReorderError: (v: string) => void;
  cancelDayEdit: () => void;
  updateTripSchedule: (next: TripDaySchedule[]) => void;
  applyScheduleReorder: (
    from: { day: number; index: number },
    to: { day: number; index: number }
  ) => Promise<boolean>;
  editingDayIndex: number | null;
  draftDay: TripDaySchedule | null;
  openDayEdit: (dayIndex: number) => void;
  updateDraftItem: (
    itemIndex: number,
    patch: Partial<{
      time: string;
      title: string;
      detail: string;
      cost: string;
    }>
  ) => void;
  sortDraftDayByTime: () => void;
  removeDraftItem: (itemIndex: number) => void;
  addDraftItem: () => void;
  saveDayEdit: (dayIndex: number) => void;
};

export function TripDetailScheduleSection(props: TripDetailScheduleSectionProps) {
  const {
    trip,
    canEdit,
    isGuest,
    detailTab,
    spendByPlaceId,
    mapHighlightKey,
    onSelectMapPoint,
    scheduleItemRefs,
    reorderMode,
    setReorderMode,
    reorderError,
    setReorderError,
    cancelDayEdit,
    updateTripSchedule,
    applyScheduleReorder,
    editingDayIndex,
    draftDay,
    openDayEdit,
    updateDraftItem,
    sortDraftDayByTime,
    removeDraftItem,
    addDraftItem,
    saveDayEdit,
  } = props;

  return (
    <>
        {(isGuest || detailTab === "schedule") &&
        trip.dailySchedule &&
        trip.dailySchedule.length > 0 ? (
          <TripMapPanel
            days={trip.dailySchedule}
            country={trip.country}
            destination={trip.destination}
            spendByPlaceId={spendByPlaceId}
            highlightKey={mapHighlightKey}
            onSelectPoint={onSelectMapPoint}
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
    </>
  );
}
