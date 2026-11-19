import type { PlanItem } from "@/lib/budget/types";

/** adjustedItems → trips.daily_schedule 형태 (기존 day 라벨 유지) */
export function mergeAdjustedIntoSchedule(
  current: unknown,
  adjusted: PlanItem[]
): unknown {
  const byKey = new Map(
    adjusted.map((i) => [`${i.day}|${i.time}|${i.title}`, i.estCost])
  );
  if (!Array.isArray(current)) {
    const byDay = new Map<number, PlanItem[]>();
    for (const item of adjusted) {
      const list = byDay.get(item.day) ?? [];
      list.push(item);
      byDay.set(item.day, list);
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, items]) => ({
        day,
        label: `${day}일차`,
        items: items.map((i) => ({
          time: i.time,
          title: i.title,
          cost: i.estCost,
          category: i.category,
        })),
        dayTotal: items.reduce((s, i) => s + i.estCost, 0),
      }));
  }

  return current.map((day) => {
    if (!day || typeof day !== "object") return day;
    const d = day as Record<string, unknown>;
    const dayNum = Number(d.day);
    const items = Array.isArray(d.items) ? d.items : [];
    const nextItems = items.map((it) => {
      if (!it || typeof it !== "object") return it;
      const row = it as Record<string, unknown>;
      const key = `${dayNum}|${String(row.time ?? "")}|${String(row.title ?? "")}`;
      const cost = byKey.get(key);
      if (cost == null) return it;
      return { ...row, cost };
    });
    const dayTotal = nextItems.reduce((s, it) => {
      if (!it || typeof it !== "object") return s;
      const c = (it as { cost?: unknown }).cost;
      return s + (typeof c === "number" ? Math.max(0, Math.trunc(c)) : 0);
    }, 0);
    return { ...d, items: nextItems, dayTotal };
  });
}
