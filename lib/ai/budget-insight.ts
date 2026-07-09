import { retrieveBudgetRag, violatesBudgetBand } from "@/lib/rag/budgetBands";

export function parseBudgetAmount(value: string): number {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function formatMan(budget: number): string {
  if (budget >= 10_000) {
    const man = Math.round(budget / 10_000);
    return `${man.toLocaleString("ko-KR")}만원`;
  }
  return `${budget.toLocaleString("ko-KR")}원`;
}

/**
 * 총 예산 단계: 인원 미정이라 "혼자 쓴다고 가정한 상한 권역" +
 * 인원이 늘면 1인당이 내려간다는 안내.
 */
export function buildLocalBudgetInsight(budget: number): string {
  if (budget <= 0) {
    return "총 예산을 입력하면 AI가 그 안에서 가능한 여행 권역을 알려드려요.";
  }

  const month = new Date().getMonth() + 1;
  const asSolo = retrieveBudgetRag(budget, month);
  const asCouple = retrieveBudgetRag(Math.floor(budget / 2), month);
  const places = asSolo.allowedRegions.slice(0, 3).join("·");

  return `총 예산 ${formatMan(budget)}이면(1인 기준) ${asSolo.band.nights} ${places} 정도가 현실적이에요. 2인이면 1인당이 줄어 ${asCouple.allowedRegions.slice(0, 2).join("·")} 쪽에 더 가까워져요.`;
}
