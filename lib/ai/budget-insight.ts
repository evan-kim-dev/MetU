import { retrieveBudgetRag } from "@/lib/rag/budgetBands";

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

  if (asSolo.allowedRegions.length === 0) {
    return `총 예산 ${formatMan(budget)}이면(1인 기준) 숙박 여행이 어려워요. 최소 15만원대 이상부터 국내 근교를 볼 수 있어요.`;
  }

  const places = asSolo.allowedRegions.slice(0, 3).join("·");
  const coupleNote =
    asCouple.allowedRegions.length === 0
      ? "2인이면 1인당이 더 줄어 숙박 여행이 빠듯해져요."
      : `2인이면 1인당이 줄어 ${asCouple.allowedRegions.slice(0, 2).join("·")} 쪽에 더 가까워져요.`;

  return `총 예산 ${formatMan(budget)}이면(1인 기준) ${asSolo.band.nights} ${places} 정도가 현실적이에요. ${coupleNote}`;
}
