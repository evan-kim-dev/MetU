"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { BudgetDonutChart } from "@/components/recommend/BudgetDonutChart";
import { formatKRW } from "@/lib/mock/home";
import { STYLE_LABELS } from "@/lib/trips/data";
import { useTrips } from "@/lib/trips/TripProvider";
import type { TripDaySchedule, TripExpense } from "@/lib/trips/types";

interface TripDetailContentProps {
  tripId: string;
}

type EditSection = "budget" | "expense" | "memo" | "schedule" | null;

function parseAmount(raw: string): number {
  return Number(raw.replace(/[^0-9]/g, "")) || 0;
}

function recalcDayTotal(day: TripDaySchedule): TripDaySchedule {
  return {
    ...day,
    dayTotal: day.items.reduce((sum, item) => sum + (item.cost || 0), 0),
  };
}

export function TripDetailContent({ tripId }: TripDetailContentProps) {
  const router = useRouter();
  const { getTrip, updateTrip, removeTrip, isReady } = useTrips();
  const trip = getTrip(tripId);

  const [editSection, setEditSection] = useState<EditSection>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // budget
  const [draftBudget, setDraftBudget] = useState("");
  // expense
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    label: "",
    category: "",
    amount: "",
    date: "",
  });
  // memo
  const [draftMemo, setDraftMemo] = useState("");
  // schedule
  const [draftSchedule, setDraftSchedule] = useState<TripDaySchedule[]>([]);

  const remaining = trip ? trip.budget - trip.spent : 0;
  const usedPercent = trip
    ? Math.round((trip.spent / Math.max(trip.budget, 1)) * 100)
    : 0;

  const styleLabels = useMemo(
    () => trip?.styles.map((style) => STYLE_LABELS[style] ?? style) ?? [],
    [trip?.styles]
  );

  const openBudgetEdit = () => {
    if (!trip) return;
    setDraftBudget(String(trip.budget));
    setEditSection("budget");
    setEditingExpenseId(null);
  };

  const saveBudget = () => {
    if (!trip) return;
    const budget = parseAmount(draftBudget);
    if (budget < 1) return;
    updateTrip(trip.id, { budget });
    setEditSection(null);
  };

  const openExpenseEdit = (expense: TripExpense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      label: expense.label,
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date,
    });
    setEditSection("expense");
  };

  const openExpenseAdd = () => {
    setEditingExpenseId("new");
    setExpenseForm({
      label: "",
      category: "기타",
      amount: "",
      date: "직접 입력",
    });
    setEditSection("expense");
  };

  const saveExpense = () => {
    if (!trip) return;
    const amount = parseAmount(expenseForm.amount);
    if (!expenseForm.label.trim() || amount < 1) return;

    let nextExpenses: TripExpense[];
    if (editingExpenseId === "new") {
      nextExpenses = [
        ...trip.expenses,
        {
          id: `exp-${Date.now()}`,
          label: expenseForm.label.trim(),
          category: expenseForm.category.trim() || "기타",
          amount,
          date: expenseForm.date.trim() || "직접 입력",
        },
      ];
    } else {
      nextExpenses = trip.expenses.map((item) =>
        item.id === editingExpenseId
          ? {
              ...item,
              label: expenseForm.label.trim(),
              category: expenseForm.category.trim() || "기타",
              amount,
              date: expenseForm.date.trim() || item.date,
            }
          : item
      );
    }

    updateTrip(trip.id, { expenses: nextExpenses });
    setEditSection(null);
    setEditingExpenseId(null);
  };

  const deleteExpense = (id: string) => {
    if (!trip) return;
    const ok = window.confirm("이 지출 항목을 삭제할까요?");
    if (!ok) return;
    updateTrip(trip.id, {
      expenses: trip.expenses.filter((item) => item.id !== id),
    });
    if (editingExpenseId === id) {
      setEditSection(null);
      setEditingExpenseId(null);
    }
  };

  const openMemoEdit = () => {
    if (!trip) return;
    setDraftMemo(trip.memo ?? "");
    setEditSection("memo");
    setEditingExpenseId(null);
  };

  const saveMemo = () => {
    if (!trip) return;
    updateTrip(trip.id, { memo: draftMemo.trim() });
    setEditSection(null);
  };

  const openScheduleEdit = () => {
    if (!trip) return;
    setDraftSchedule(
      (trip.dailySchedule ?? []).map((day) => ({
        ...day,
        items: day.items.map((item) => ({ ...item })),
      }))
    );
    setEditSection("schedule");
    setEditingExpenseId(null);
  };

  const updateDraftDayLabel = (dayIndex: number, label: string) => {
    setDraftSchedule((prev) =>
      prev.map((day, idx) => (idx === dayIndex ? { ...day, label } : day))
    );
  };

  const updateDraftItem = (
    dayIndex: number,
    itemIndex: number,
    patch: Partial<{ time: string; title: string; cost: string }>
  ) => {
    setDraftSchedule((prev) =>
      prev.map((day, dIdx) => {
        if (dIdx !== dayIndex) return day;
        const items = day.items.map((item, iIdx) => {
          if (iIdx !== itemIndex) return item;
          return {
            ...item,
            time: patch.time ?? item.time,
            title: patch.title ?? item.title,
            cost:
              patch.cost !== undefined ? parseAmount(patch.cost) : item.cost,
          };
        });
        return recalcDayTotal({ ...day, items });
      })
    );
  };

  const addDraftItem = (dayIndex: number) => {
    setDraftSchedule((prev) =>
      prev.map((day, idx) => {
        if (idx !== dayIndex) return day;
        return recalcDayTotal({
          ...day,
          items: [...day.items, { time: "12:00", title: "", cost: 0 }],
        });
      })
    );
  };

  const removeDraftItem = (dayIndex: number, itemIndex: number) => {
    setDraftSchedule((prev) =>
      prev.map((day, idx) => {
        if (idx !== dayIndex) return day;
        return recalcDayTotal({
          ...day,
          items: day.items.filter((_, i) => i !== itemIndex),
        });
      })
    );
  };

  const saveSchedule = () => {
    if (!trip) return;
    const cleaned = draftSchedule.map((day) =>
      recalcDayTotal({
        ...day,
        label: day.label.trim() || `Day ${day.day}`,
        items: day.items
          .map((item) => ({
            ...item,
            time: item.time.trim() || "00:00",
            title: item.title.trim(),
            cost: item.cost || 0,
          }))
          .filter((item) => item.title.length > 0),
      })
    );
    updateTrip(trip.id, { dailySchedule: cleaned });
    setEditSection(null);
  };

  const handleDelete = () => {
    if (!trip || isDeleting) return;
    const ok = window.confirm(
      `"${trip.destination}" 여행을 삭제할까요?\n홈의 진행 중 여행·팁·환율도 함께 갱신돼요.`
    );
    if (!ok) return;
    setIsDeleting(true);
    removeTrip(trip.id);
    router.replace("/");
  };

  if (!isReady) {
    return (
      <MobileShell title="여행 상세" showBack backHref="/trips">
        <div className="px-5 pt-5">
          <div className="h-56 animate-pulse rounded-xl2 bg-surface-soft" />
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
    <MobileShell title="여행 상세" showBack backHref="/trips">
      <div className="flex flex-col gap-6 px-5 pb-8 pt-5">
        {/* 히어로 */}
        <div className="relative h-56 overflow-hidden rounded-xl2 shadow-soft">
          <Image
            src={trip.imageUrl}
            alt={`${trip.destination} 여행`}
            fill
            sizes="440px"
            className="object-cover"
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
          <InfoCard
            icon={<Users className="h-4 w-4" />}
            label="인원"
            value={`${trip.people}명`}
          />
          <InfoCard
            icon={<MapPin className="h-4 w-4" />}
            label="출발지"
            value={trip.origin}
          />
        </section>

        {/* 예산 */}
        <section className="rounded-xl2 border border-line-soft bg-surface-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand" />
              <h3 className="text-lg font-extrabold text-ink-heading">예산</h3>
            </div>
            {editSection !== "budget" && (
              <IconButton label="예산 수정" onClick={openBudgetEdit}>
                <Pencil className="h-4 w-4" strokeWidth={2.2} />
              </IconButton>
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
        {((trip.dailySchedule && trip.dailySchedule.length > 0) ||
          editSection === "schedule") && (
          <section className="rounded-xl2 border border-line-soft bg-surface-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-brand" />
                <h3 className="text-lg font-extrabold text-ink-heading">
                  일정표
                </h3>
              </div>
              {editSection !== "schedule" && (
                <IconButton label="일정표 수정" onClick={openScheduleEdit}>
                  <Pencil className="h-4 w-4" strokeWidth={2.2} />
                </IconButton>
              )}
            </div>

            {editSection === "schedule" ? (
              <div className="flex flex-col gap-4">
                {draftSchedule.map((day, dayIndex) => (
                  <div
                    key={`edit-day-${day.day}`}
                    className="rounded-xl border border-line-soft bg-surface-base p-4"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span className="shrink-0 text-sm font-extrabold text-brand">
                        Day {day.day}
                      </span>
                      <input
                        value={day.label}
                        onChange={(e) =>
                          updateDraftDayLabel(dayIndex, e.target.value)
                        }
                        placeholder="하루 테마"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-line-muted bg-surface-white px-2.5 text-xs font-semibold text-ink-heading focus:border-brand focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      {day.items.map((item, itemIndex) => (
                        <div
                          key={`edit-${day.day}-${itemIndex}`}
                          className="rounded-lg border border-line-soft bg-surface-white p-3"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <input
                              value={item.time}
                              onChange={(e) =>
                                updateDraftItem(dayIndex, itemIndex, {
                                  time: e.target.value,
                                })
                              }
                              placeholder="14:00"
                              className="h-9 w-20 rounded-lg border border-line-muted px-2 text-xs font-semibold text-ink-caption focus:border-brand focus:outline-none"
                            />
                            <input
                              inputMode="numeric"
                              value={item.cost > 0 ? String(item.cost) : ""}
                              onChange={(e) =>
                                updateDraftItem(dayIndex, itemIndex, {
                                  cost: e.target.value.replace(/[^0-9]/g, ""),
                                })
                              }
                              placeholder="금액"
                              className="h-9 min-w-0 flex-1 rounded-lg border border-line-muted px-2 text-xs font-bold text-ink-heading focus:border-brand focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                removeDraftItem(dayIndex, itemIndex)
                              }
                              aria-label="일정 항목 삭제"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-danger active:bg-danger/10"
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                            </button>
                          </div>
                          <input
                            value={item.title}
                            onChange={(e) =>
                              updateDraftItem(dayIndex, itemIndex, {
                                title: e.target.value,
                              })
                            }
                            placeholder="일정 내용"
                            className="h-9 w-full rounded-lg border border-line-muted px-2.5 text-sm text-ink-body focus:border-brand focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => addDraftItem(dayIndex)}
                      className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                      일정 추가
                    </button>

                    <p className="mt-3 border-t border-line-soft pt-2 text-right text-xs font-bold text-brand">
                      일일 예상 {formatKRW(day.dayTotal)}
                    </p>
                  </div>
                ))}

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
                    onClick={saveSchedule}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-surface-white"
                  >
                    <Check className="h-4 w-4" />
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {(trip.dailySchedule ?? []).map((day) => (
                  <div
                    key={day.day}
                    className="rounded-xl border border-line-soft bg-surface-base p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-brand">
                        Day {day.day}
                      </span>
                      <span className="text-xs font-semibold text-ink-caption">
                        {day.label}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {day.items.map((item) => (
                        <div
                          key={`${day.day}-${item.time}-${item.title}`}
                          className="flex items-start justify-between gap-3"
                        >
                          <div>
                            <p className="text-xs font-semibold text-ink-caption">
                              {item.time}
                            </p>
                            <p className="text-sm font-medium text-ink-body">
                              {item.title}
                            </p>
                          </div>
                          {item.cost > 0 && (
                            <span className="shrink-0 text-xs font-bold text-ink-heading">
                              {formatKRW(item.cost)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 border-t border-line-soft pt-2 text-right text-xs font-bold text-brand">
                      일일 예상 {formatKRW(day.dayTotal)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

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
            <ExpenseEditor
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
                <ExpenseEditor
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
                  <IconButton
                    label={`${expense.label} 수정`}
                    onClick={() => openExpenseEdit(expense)}
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2.2} />
                  </IconButton>
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
              <IconButton label="메모 수정" onClick={openMemoEdit}>
                <Pencil className="h-4 w-4" strokeWidth={2.2} />
              </IconButton>
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

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-caption transition-colors active:bg-surface-soft"
    >
      {children}
    </button>
  );
}

function ExpenseEditor({
  form,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: {
  form: { label: string; category: string; amount: string; date: string };
  onChange: (next: {
    label: string;
    category: string;
    amount: string;
    date: string;
  }) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-brand/30 bg-brand/5 p-3">
      <input
        value={form.label}
        onChange={(e) => onChange({ ...form, label: e.target.value })}
        placeholder="항목명 (예: 항공권)"
        className="h-10 rounded-xl border border-line-muted bg-surface-white px-3 text-sm font-bold text-ink-heading focus:border-brand focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.category}
          onChange={(e) => onChange({ ...form, category: e.target.value })}
          placeholder="카테고리"
          className="h-10 rounded-xl border border-line-muted bg-surface-white px-3 text-sm text-ink-heading focus:border-brand focus:outline-none"
        />
        <input
          value={form.date}
          onChange={(e) => onChange({ ...form, date: e.target.value })}
          placeholder="날짜/메모"
          className="h-10 rounded-xl border border-line-muted bg-surface-white px-3 text-sm text-ink-heading focus:border-brand focus:outline-none"
        />
      </div>
      <input
        inputMode="numeric"
        value={form.amount}
        onChange={(e) =>
          onChange({ ...form, amount: e.target.value.replace(/[^0-9]/g, "") })
        }
        placeholder="금액"
        className="h-10 rounded-xl border border-line-muted bg-surface-white px-3 text-sm font-bold text-ink-heading focus:border-brand focus:outline-none"
      />
      <div className="flex gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-red-200 px-3 py-2.5 text-sm font-bold text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-line-muted py-2.5 text-sm font-bold text-ink-body"
        >
          <X className="h-4 w-4" />
          취소
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-surface-white"
        >
          <Check className="h-4 w-4" />
          저장
        </button>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface-white p-4">
      <div className="mb-2 flex items-center gap-1.5 text-brand">
        {icon}
        <span className="text-xs font-semibold text-ink-caption">{label}</span>
      </div>
      <p className="text-base font-extrabold text-ink-heading">{value}</p>
    </div>
  );
}
