"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { isFixedItem } from "@/lib/route/recompute-day";
import { formatKRW } from "@/lib/shared/format";
import type { TripDaySchedule, TripScheduleItem } from "@/lib/trips/types";

export interface SortableDayListProps {
  days: TripDaySchedule[];
  onReorder: (
    from: { day: number; index: number },
    to: { day: number; index: number }
  ) => void;
}

function itemId(day: number, index: number) {
  return `d${day}-i${index}`;
}

function parseId(id: string): { day: number; index: number } | null {
  const m = /^d(\d+)-i(\d+)$/.exec(id);
  if (!m) return null;
  return { day: Number(m[1]), index: Number(m[2]) };
}

export function SortableDayList({ days, onReorder }: SortableDayListProps) {
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const flatIds = useMemo(
    () =>
      days.flatMap((d) => d.items.map((_, i) => itemId(d.day, i))),
    [days]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    setError(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = parseId(String(active.id));
    const to = parseId(String(over.id));
    if (!from || !to) return;

    const fromDay = days.find((d) => d.day === from.day);
    const item = fromDay?.items[from.index];
    if (item && isFixedItem(item)) {
      setError("체크인·공항 같은 고정 일정은 순서를 바꿀 수 없어요.");
      return;
    }
    onReorder(from, to);
  };

  const moveByButton = (
    day: number,
    index: number,
    dir: -1 | 1
  ) => {
    setError(null);
    const dayObj = days.find((d) => d.day === day);
    if (!dayObj) return;
    const item = dayObj.items[index];
    if (item && isFixedItem(item)) {
      setError("체크인·공항 같은 고정 일정은 순서를 바꿀 수 없어요.");
      return;
    }
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= dayObj.items.length) return;
    onReorder({ day, index }, { day, index: nextIndex });
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
          {days.map((day) => (
            <div
              key={day.day}
              className="rounded-2xl border-0 bg-surface-soft p-4 shadow-sm"
            >
              <p className="mb-3 text-sm font-extrabold text-brand">
                {day.day}일차
              </p>
              <div className="flex flex-col gap-2">
                {day.items.map((item, index) => (
                  <SortableRow
                    key={itemId(day.day, index)}
                    id={itemId(day.day, index)}
                    item={item}
                    fixed={isFixedItem(item)}
                    onMoveUp={() => moveByButton(day.day, index, -1)}
                    onMoveDown={() => moveByButton(day.day, index, 1)}
                  />
                ))}
              </div>
              <p className="mt-3 border-t border-line-soft pt-2 text-right text-xs font-bold text-brand">
                일일 예상 {formatKRW(day.dayTotal)}
              </p>
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableRow({
  id,
  item,
  fixed,
  onMoveUp,
  onMoveDown,
}: {
  id: string;
  item: TripScheduleItem;
  fixed: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: fixed });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded-lg border border-line-soft bg-surface-white p-3"
    >
      {!fixed ? (
        <button
          type="button"
          className="mt-0.5 touch-none text-ink-caption"
          aria-label="끌어서 순서 바꾸기"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className="mt-0.5 w-4" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-caption">{item.time}</p>
        <p className="text-sm font-bold text-ink-heading">{item.title}</p>
        {item.detail ? (
          <p className="mt-0.5 text-sm text-ink-body">{item.detail}</p>
        ) : null}
      </div>
      {!fixed ? (
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            aria-label="위로"
            onClick={onMoveUp}
            className="rounded p-1 text-ink-caption active:bg-surface-soft"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="아래로"
            onClick={onMoveDown}
            className="rounded p-1 text-ink-caption active:bg-surface-soft"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** 같은 일차 안에서만 arrayMove 가 필요할 때 헬퍼(테스트/디버그용) */
export function reorderWithinDay(
  items: TripScheduleItem[],
  from: number,
  to: number
): TripScheduleItem[] {
  return arrayMove(items, from, to);
}
