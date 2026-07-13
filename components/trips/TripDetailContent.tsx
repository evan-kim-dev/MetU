"use client";

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
import { useTripDetailEditor, sortScheduleItemsByTime } from "@/components/trips/useTripDetailEditor";
import { formatKRW } from "@/lib/shared/format";

interface TripDetailContentProps {
  tripId: string;
}

export function TripDetailContent({ tripId }: TripDetailContentProps) {
  const router = useRouter();
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
    handleDelete,
    handleShareTrip,
  } = useTripDetailEditor(tripId);

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
      rightSlot={shareButton}
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
              ? `D-${trip.dDay}`
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
            {editSection !== "budget" && (
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

        {/* AI 일정표 */}
        {trip.dailySchedule && trip.dailySchedule.length > 0 ? (
          <section className="rounded-2xl border-0 bg-surface-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brand" />
              <h3 className="text-lg font-extrabold text-ink-heading">일정표</h3>
            </div>

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
                            Day {draftDay.day}
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
                            Day {day.day}
                          </span>
                          <TripIconButton
                            label={`Day ${day.day} 일정 수정`}
                            onClick={() => openDayEdit(dayIndex)}
                          >
                            <Pencil className="h-4 w-4" strokeWidth={2.2} />
                          </TripIconButton>
                        </div>
                        <div className="flex flex-col gap-2">
                          {sortScheduleItemsByTime(day.items).map((item) => (
                            <div
                              key={`${day.day}-${item.time}-${item.title}`}
                              className="flex items-start justify-between gap-3"
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
                              </div>
                              {item.cost > 0 ? (
                                <span className="shrink-0 text-xs font-bold text-ink-heading">
                                  {formatKRW(item.cost)}
                                </span>
                              ) : null}
                            </div>
                          ))}
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

        {/* 지출 내역 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-ink-heading">
              지출 내역
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

        {/* 메모 */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-ink-heading">메모</h3>
            {editSection !== "memo" && (
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
              {trip.memo?.trim() ? trip.memo : "메모가 없어요. 연필 아이콘으로 추가하세요."}
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-bold text-red-600 transition-colors active:bg-red-100 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.2} />
          {isDeleting ? "삭제 중..." : "여행 삭제하기"}
        </button>
      </div>
    </MobileShell>
  );
}
