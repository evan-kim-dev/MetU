import { cache } from "react";
import type { DealPlace } from "@/lib/deals/data";

/** Early-access: 홈 추천은 데모 없이 빈 목록으로 시작 */
const loadRecommended = cache(async (): Promise<DealPlace[]> => []);

export async function loadHomeData() {
  const recommended = await loadRecommended();
  return { recommended };
}
