/**
 * 온보딩 확인 카드용 표시 분배.
 * 금액 확정이 아니라 UI 미리보기이며, 계산은 lib/budget/engine allocate 단일 소스.
 */
import { allocate, planToSegments } from "@/lib/budget/engine/allocate";

export type DisplayAllocSegment = {
  id: string;
  label: string;
  percent: number;
  amount: number;
};

export function buildDisplayAllocation(totalKrw: number): DisplayAllocSegment[] {
  const plan = allocate({
    total: Math.max(0, Math.floor(totalKrw)),
    travelers: 2,
    nights: 3,
  });
  return planToSegments(plan).map((s) => ({
    id: s.id,
    label: s.label,
    percent: s.percent,
    amount: s.amount,
  }));
}
