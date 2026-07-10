import { cache } from "react";
import { MOCK_DEALS } from "@/lib/deals/data";

const loadRecommended = cache(async () => MOCK_DEALS);

export const loadHomeData = cache(async () => {
  const recommended = await loadRecommended();
  return { recommended };
});
