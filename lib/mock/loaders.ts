/** mock 아님: 기본값/필터 */
import { cache } from "react";
import type { DealPlace } from "@/lib/deals/data";

/** SSR 초기값: 클라이언트 RecommendedGrid가 /api/recommended-deals 로 채운다 */
const loadRecommended = cache(async (): Promise<DealPlace[]> => []);

export async function loadHomeData() {
  const recommended = await loadRecommended();
  return { recommended };
}
