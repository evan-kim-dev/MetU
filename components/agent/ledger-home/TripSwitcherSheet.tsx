"use client";

import { Plus } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { Trip, TripStatus } from "@/lib/trips/types";

type Props = {
  open: boolean;
  onClose: () => void;
  trips: Trip[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export const SWITCHER_MAX_TRIPS = 12;

const STATUS_CHIP: Record<TripStatus, { label: string; tone: string }> = {
  ongoing: { label: "여행 중", tone: "bg-mint/30 text-success" },
  upcoming: { label: "예정", tone: "bg-brand/10 text-brand" },
  completed: { label: "완료", tone: "bg-surface-soft text-ink-body" },
};

export function TripSwitcherSheet({
  open,
  onClose,
  trips,
  selectedId,
  onSelect,
  onCreate,
  returnFocusRef,
}: Props) {
  const list = trips.slice(0, SWITCHER_MAX_TRIPS);
  const selected = trips.find((t) => t.id === selectedId);
  // 선택한 여행이 12개 밖이어도 목록에는 보이게 한다.
  const shown =
    selected && !list.some((t) => t.id === selected.id)
      ? [selected, ...list.slice(0, SWITCHER_MAX_TRIPS - 1)]
      : list;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="여행 바꾸기"
      returnFocusRef={returnFocusRef}
    >
      <ul className="flex flex-col gap-2">
        {shown.map((t) => {
          const chip = STATUS_CHIP[t.status];
          const active = t.id === selectedId;
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => {
                  onSelect(t.id);
                  onClose();
                }}
                className={`flex min-h-tap w-full items-center gap-3 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  active
                    ? "bg-surface-soft ring-1 ring-brand"
                    : "bg-surface-white ring-1 ring-line-soft"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink-heading">
                    {t.destination}
                  </span>
                  <span className="block truncate text-xs text-ink-caption">
                    {t.dateRange}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${chip.tone}`}
                >
                  {chip.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => {
          onClose();
          onCreate();
        }}
        className="mt-1 inline-flex min-h-tap items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Plus className="h-4 w-4" aria-hidden />
        새 여행 만들기
      </button>
    </BottomSheet>
  );
}
