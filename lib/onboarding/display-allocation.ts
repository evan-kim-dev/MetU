/**
 * 온보딩 확인 카드용 표시 비율만 계산해요.
 * LLM/서버 금액 확정이 아니라 UI 미리보기입니다.
 */
export type DisplayAllocSegment = {
  id: string;
  label: string;
  percent: number;
  amount: number;
};

const BASE: Array<{ id: string; label: string; weight: number }> = [
  { id: "flight", label: "항공·이동", weight: 0.25 },
  { id: "hotel", label: "숙소", weight: 0.3 },
  { id: "food", label: "식비", weight: 0.2 },
  { id: "transport", label: "교통", weight: 0.1 },
  { id: "activity", label: "관광", weight: 0.15 },
];

export function buildDisplayAllocation(totalKrw: number): DisplayAllocSegment[] {
  const total = Math.max(0, Math.floor(totalKrw));
  return BASE.map((item) => {
    const amount = Math.round(total * item.weight);
    return {
      id: item.id,
      label: item.label,
      percent: Math.round(item.weight * 100),
      amount,
    };
  });
}
