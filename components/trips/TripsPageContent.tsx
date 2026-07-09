"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { TripListCard } from "@/components/trips/TripListCard";
import { useTrips } from "@/lib/trips/TripProvider";

export function TripsPageContent() {
  const { trips, isReady, removeTrip } = useTrips();
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => trips.some((trip) => trip.id === id))
    );
  }, [trips]);

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const allSelected =
    trips.length > 0 && selectedIds.length === trips.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : trips.map((trip) => trip.id));
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const ok = window.confirm(
      `선택한 여행 ${count}개를 삭제할까요?\n삭제하면 되돌릴 수 없어요.`
    );
    if (!ok) return;
    selectedIds.forEach((id) => removeTrip(id));
    exitEditMode();
  };

  return (
    <MobileShell title="내 여행">
      <div className="flex flex-col gap-4 px-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          {editMode ? (
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-1 transition-colors active:bg-surface-soft"
                >
                  <span
                    className={[
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                      allSelected
                        ? "border-brand bg-brand text-surface-white"
                        : "border-line-muted bg-surface-white",
                    ].join(" ")}
                    aria-hidden
                  >
                    {allSelected && (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    )}
                  </span>
                  <span className="text-sm font-semibold text-ink-caption">
                    전체선택
                  </span>
                </button>
                <button
                  type="button"
                  onClick={
                    selectedIds.length > 0
                      ? handleDeleteSelected
                      : exitEditMode
                  }
                  aria-label={
                    selectedIds.length > 0 ? "선택한 여행 삭제" : "수정 취소"
                  }
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors active:bg-surface-soft",
                    selectedIds.length > 0 ? "text-danger" : "text-ink-heading",
                  ].join(" ")}
                >
                  {selectedIds.length > 0 ? (
                    <Trash2 className="h-5 w-5" strokeWidth={2.2} />
                  ) : (
                    <X className="h-5 w-5" strokeWidth={2.2} />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-caption">
                총 {trips.length}개의 여행 기록이 있어요.
              </p>
              {isReady && trips.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  aria-label="여행 목록 수정"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink-heading transition-colors active:bg-surface-soft"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2.2} />
                </button>
              )}
            </>
          )}
        </div>

        {!isReady ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-xl2 bg-surface-soft"
              />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-base font-bold text-ink-heading">
              아직 여행이 없어요
            </p>
            <p className="text-sm text-ink-caption">
              첫 여행을 계획하고 AI 추천을 받아보세요.
            </p>
            <Link
              href="/onboarding"
              className="mt-2 rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-surface-white"
            >
              여행 계획하기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trips.map((trip) => (
              <TripListCard
                key={trip.id}
                trip={trip}
                editMode={editMode}
                selected={selectedIds.includes(trip.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}

        {editMode && trips.length > 0 && (
          <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 pt-2">
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleDeleteSelected}
              className={[
                "flex w-full items-center justify-center gap-2 rounded-xl2 py-3.5 text-sm font-bold transition-colors",
                selectedIds.length > 0
                  ? "bg-danger text-surface-white active:brightness-95"
                  : "cursor-not-allowed bg-surface-soft text-ink-caption",
              ].join(" ")}
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.4} />
              {selectedIds.length > 0
                ? `${selectedIds.length}개 삭제`
                : "삭제할 여행 선택"}
            </button>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
