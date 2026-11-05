import type { DaySchedule } from "@/lib/ai/types";
import {
  classifyRebalanceCategory,
  type RebalanceItem,
} from "@/lib/budget/rebalancer";

export function scheduleToRebalanceItems(
  schedule: DaySchedule[]
): RebalanceItem[] {
  const items: RebalanceItem[] = [];
  for (const day of schedule) {
    for (let i = 0; i < day.items.length; i += 1) {
      const item = day.items[i]!;
      items.push({
        id: `d${day.day}-${i}-${item.title}`,
        name: `Day ${day.day} ${item.title}`,
        category: classifyRebalanceCategory(item.kind, item.title),
        costKRW: Math.max(0, Math.floor(item.cost)),
        isFixed: item.kind === "attraction" || item.kind === "lodging",
      });
    }
  }
  return items;
}

export function applyRebalanceCostsToSchedule(
  schedule: DaySchedule[],
  adjusted: RebalanceItem[]
): DaySchedule[] {
  const costById = new Map(adjusted.map((a) => [a.id, a.costKRW]));
  return schedule.map((day) => {
    const items = day.items.map((item, i) => {
      const id = `d${day.day}-${i}-${item.title}`;
      const next = costById.get(id);
      return next == null ? item : { ...item, cost: next };
    });
    return {
      ...day,
      items,
      dayTotal: items.reduce((s, it) => s + it.cost, 0),
    };
  });
}

/** 슬라이더 미리보기: 현재 일정 합 − 목표 현지 가용 */
export function previewDiscretionaryGap(params: {
  schedule: DaySchedule[];
  targetDiscretionaryBudget: number;
}): { scheduleTotal: number; gap: number } {
  const scheduleTotal = params.schedule.reduce(
    (sum, day) =>
      sum +
      day.items.reduce((s, it) => s + Math.max(0, Math.floor(it.cost)), 0),
    0
  );
  const target = Math.max(0, Math.floor(params.targetDiscretionaryBudget));
  return { scheduleTotal, gap: scheduleTotal - target };
}
