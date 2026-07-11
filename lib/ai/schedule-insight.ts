import { retrieveBudgetRag } from "@/lib/rag/budgetBands";
import {
  formatMonthDealInsight,
  getMonthDealTip,
} from "@/lib/rag/monthDeals";

export type ScheduleDateType = "specific" | "flexible";

export interface ScheduleInsightInput {
  origin: string;
  destination: string;
  dateType: ScheduleDateType;
  startDate: string;
  endDate: string;
  flexibleYear: number;
  flexibleMonth: number;
  budget?: number;
  people?: number;
}

function resolveSeasonMonth(params: ScheduleInsightInput): number {
  if (params.dateType === "specific" && params.startDate) {
    return Number(params.startDate.slice(5, 7)) || params.flexibleMonth;
  }
  return params.flexibleMonth;
}

function shortPlace(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.split(/[,，·]/)[0]?.trim() || trimmed;
}

/**
 * AI 실패/대기 중에도 보여줄 시즌·가성비 로컬 인사이트.
 * 언제 어디가 싼지 + 예산 허용 권역을 바로 표시한다.
 */
export function buildLocalScheduleInsight(
  params: ScheduleInsightInput
): string {
  const month = resolveSeasonMonth(params);
  const tip = getMonthDealTip(month);
  const cheap = tip.cheapPlaces.slice(0, 3).join("·");
  const from = shortPlace(params.origin) || "출발지";
  const to = shortPlace(params.destination);
  const people = Math.max(1, params.people ?? 1);
  const totalBudget = params.budget ?? 0;
  const perPerson =
    totalBudget > 0 ? Math.floor(totalBudget / people) : 0;
  const budgetRag =
    perPerson > 0 ? retrieveBudgetRag(perPerson, month) : null;
  const allowed = budgetRag?.allowedRegions.slice(0, 3).join("·") ?? "";

  if (params.dateType === "flexible") {
    if (to) {
      const budgetNote = allowed
        ? ` 지금 예산(1인 약 ${perPerson.toLocaleString("ko-KR")}원)이면 ${allowed} 권역이 현실적이에요.`
        : "";
      return `${params.flexibleYear}년 ${month}월 ${from}→${to}라면, 같은 달 가성비는 ${cheap} 쪽이 강한 편이에요. ${tip.dealReason}. 다만 ${tip.caution}${budgetNote}`;
    }
    const budgetNote = allowed
      ? ` 예산 기준으로는 ${allowed}을 먼저 보세요.`
      : "";
    return `${params.flexibleYear}년 ${formatMonthDealInsight(month)}${budgetNote}`;
  }

  // specific dates
  if (params.startDate && params.endDate) {
    if (to) {
      const budgetNote = allowed
        ? ` 1인 예산대라면 ${allowed}과 비슷한 동선이 무난해요.`
        : "";
      return `${from}→${to}, ${params.startDate}~${params.endDate}(${month}월) 구간이에요. 이맘때 가성비는 ${cheap} 쪽이 잘 나오고, ${tip.dealReason}. ${tip.caution}${budgetNote}`;
    }
    const budgetNote = allowed
      ? ` 예산에 맞는 추천은 ${allowed}이에요.`
      : "";
    return `${month}월(${params.startDate}~${params.endDate})엔 ${cheap} 쪽이 비교적 저렴해요. ${tip.dealReason}. ${tip.caution}${budgetNote}`;
  }

  if (params.startDate) {
    return `${month}월 출발이면 ${cheap} 쪽이 가성비가 좋아요. 귀국일을 고르면 더 맞춰 드릴게요.`;
  }

  return `${month}월 기준으로는 ${cheap} 쪽이 비교적 저렴해요. ${tip.dealReason}. 날짜를 고르면 항공·숙소 타이밍까지 맞춰 드릴게요.`;
}

export function buildScheduleRagContexts(
  params: ScheduleInsightInput
): string[] {
  const month = resolveSeasonMonth(params);
  const tip = getMonthDealTip(month);
  const people = Math.max(1, params.people ?? 1);
  const totalBudget = params.budget ?? 0;
  const perPerson =
    totalBudget > 0 ? Math.floor(totalBudget / people) : 0;
  const budgetRag =
    perPerson > 0 ? retrieveBudgetRag(perPerson, month) : null;

  return [
    `${month}월 가성비 권역: ${tip.cheapPlaces.join(", ")}`,
    tip.dealReason,
    tip.caution,
    params.origin
      ? `출발지 ${params.origin} 기준`
      : "출발지 미입력",
    params.destination
      ? `목적지 ${params.destination} 선택됨`
      : "목적지 미입력(어디든지) — 가성비 추천지를 제안하세요",
    totalBudget > 0
      ? `총예산 ${totalBudget.toLocaleString("ko-KR")}원 / ${people}명 / 1인 약 ${perPerson.toLocaleString("ko-KR")}원`
      : "예산 미전달",
    budgetRag
      ? `예산 허용 권역: ${budgetRag.allowedRegions.join(", ") || "(없음)"}`
      : "예산 RAG 없음",
    budgetRag?.seasonTip ?? "",
  ].filter(Boolean);
}
