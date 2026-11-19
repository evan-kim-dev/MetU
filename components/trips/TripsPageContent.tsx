"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Check, Pencil, Plane, Trash2, X } from "lucide-react";
import { AutomationStatusBanner } from "@/components/home/AutomationStatusBanner";
import { MobileShell } from "@/components/layout/MobileShell";
import { TripListCard } from "@/components/trips/TripListCard";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useTrips } from "@/lib/trips/TripProvider";

const emptyCtaClass =
  "mu-focus inline-flex h-14 w-full items-center justify-center rounded-mu-lg bg-mu-accent px-5 text-mu-body font-semibold text-mu-on-accent";

const VisitedWorldMap = dynamic(
  () =>
    import("@/components/trips/VisitedWorldMap").then((m) => m.VisitedWorldMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-40 w-full animate-pulse rounded-2xl bg-mu-sunken"
        aria-hidden
      />
    ),
  }
);

export function TripsPageContent() {
  const { isAnonymous, provider } = useAuth();
  const { trips, isReady, removeTrip } = useTrips();
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isGuest = provider === "guest";
  const canCreateTrip = !isAnonymous && !isGuest;

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
    <MobileShell>
      <div className="flex flex-col gap-4 px-5 pt-5">
        {!editMode ? <AutomationStatusBanner ignoreFirstRun /> : null}
        {isReady && !editMode ? <VisitedWorldMap trips={trips} /> : null}

        <div className="flex items-start justify-between gap-3">
          {editMode ? (
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-1 transition-colors active:bg-mu-sunken"
                >
                  <span
                    className={[
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                      allSelected
                        ? "border-mu-accent bg-mu-accent text-mu-on-accent"
                        : "border-mu-line bg-mu-card",
                    ].join(" ")}
                    aria-hidden
                  >
                    {allSelected && (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    )}
                  </span>
                  <span className="text-sm font-semibold text-mu-fg-3">
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
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors active:bg-mu-sunken",
                    selectedIds.length > 0 ? "text-mu-err" : "text-mu-fg",
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
              <div className="min-w-0">
                <h1 className="text-heading font-bold tracking-tight text-mu-fg">
                  내 여행
                </h1>
                <p className="mt-1 text-sm text-mu-fg-3">
                  총 {trips.length}개의 여행 기록이 있어요.
                </p>
              </div>
              {isReady && trips.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  aria-label="여행 목록 수정"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-mu-fg transition-colors active:bg-mu-sunken"
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
                className="h-28 animate-pulse rounded-2xl bg-mu-sunken"
              />
            ))}
          </div>
        ) : isGuest ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-mu-card px-5 py-12 text-center shadow-soft ring-1 ring-mu-line">
            <p className="text-base font-extrabold text-mu-fg">
              로그인하면 내 여행을 볼 수 있어요
            </p>
            <p className="text-sm leading-relaxed text-mu-fg-3">
              여행·가계부가 기기에만 남지 않고 계정에 저장돼요.
            </p>
            <Link
              href="/login?next=/trips"
              className="inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-2xl bg-mu-accent px-6 text-sm font-bold text-mu-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent"
            >
              로그인하기
            </Link>
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-mu-xl border border-dashed border-mu-line bg-mu-card px-5 py-12 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-mu-lg bg-mu-accent-soft text-mu-accent"
              aria-hidden
            >
              <Plane className="h-7 w-7" strokeWidth={2.2} />
            </span>
            <div className="flex flex-col gap-1.5">
              <p className="text-mu-body font-bold text-mu-fg">
                아직 여행이 없어요
              </p>
              <p className="text-mu-caption leading-relaxed text-mu-fg-3">
                여행을 만들면 가계부와 알림 기록이 여행별로 모여요.
              </p>
            </div>
            <div className="mt-1 w-full max-w-xs">
              {canCreateTrip ? (
                <Link href="/onboarding" className={emptyCtaClass}>
                  여행 만들기
                </Link>
              ) : isGuest ? (
                <Link
                  href={`/login?next=${encodeURIComponent("/trips")}`}
                  className={emptyCtaClass}
                >
                  로그인하고 여행 만들기
                </Link>
              ) : (
                <p className="text-center text-mu-caption text-mu-fg-3">
                  초대 링크로 합류한 뒤에는 새 여행을 만들 수 없어요.
                </p>
              )}
            </div>
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
          <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 pt-2">
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleDeleteSelected}
              className={[
                "flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-colors",
                selectedIds.length > 0
                  ? "bg-mu-err text-mu-on-accent active:brightness-95"
                  : "cursor-not-allowed bg-mu-sunken text-mu-fg-3",
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
