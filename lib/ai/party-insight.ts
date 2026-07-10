import { parseBudgetAmount } from "@/lib/ai/budget-insight";
import { retrieveBudgetRag } from "@/lib/rag/budgetBands";

export { parseBudgetAmount };

function formatMan(budget: number): string {
  if (budget >= 10_000) {
    return `${Math.round(budget / 10_000).toLocaleString("ko-KR")}만원`;
  }
  return `${budget.toLocaleString("ko-KR")}원`;
}

function partyTip(people: number): string {
  if (people === 1) return "혼자면 게스트하우스·도미토리로 숙박 비중을 낮추기 좋아요";
  if (people === 2) return "숙소·교통을 나누면 1인 부담이 확 줄어요";
  if (people === 3) return "패밀리룸·에어비앤비 통임대가 효율적이에요";
  return "숙소 통째 임대·렌터카가 유리해요";
}

/**
 * 인원 단계용 로컬 인사이트 (예산 RAG 기반).
 */
export function buildLocalPartyInsight(
  totalBudget: number,
  people: number,
  month = new Date().getMonth() + 1
): string {
  if (totalBudget <= 0) {
    return "앞에서 총 예산을 입력하면, 인원에 맞춰 1인당 예산과 시즌 추천을 알려드려요.";
  }

  const safePeople = Math.max(1, people);
  const perPerson = Math.floor(totalBudget / safePeople);
  const { band, allowedRegions, seasonTip } = retrieveBudgetRag(
    perPerson,
    month
  );

  if (allowedRegions.length === 0) {
    return `${safePeople}인이면 1인당 약 ${formatMan(perPerson)}이에요. 이 예산으로는 숙박 여행이 어려워요. 총 예산을 올리거나 인원을 줄여보세요.`;
  }

  const places = allowedRegions.slice(0, 3).join("·");

  return `${safePeople}인이면 1인당 약 ${formatMan(perPerson)}이에요. ${band.nights} ${places} 정도가 현실적이에요. ${partyTip(safePeople)}. ${month}월에는 ${seasonTip}.`;
}
