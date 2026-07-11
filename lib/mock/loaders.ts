import { cache } from "react";
import { MOCK_DEALS, type DealPlace } from "@/lib/deals/data";

/** SSR 초기값: 시즌 AI 보강은 클라이언트 RecommendedGrid에서 수행 */
const loadRecommended = cache(async (): Promise<DealPlace[]> => MOCK_DEALS);

export async function loadHomeData() {
  const recommended = await loadRecommended();
  return { recommended };
}
