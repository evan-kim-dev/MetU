import { cache } from "react";
import { MOCK_DEALS } from "@/lib/deals/data";
import { MOCK_SMART_TIPS, MOCK_USER } from "./home";

const loadUser = cache(async () => MOCK_USER);
const loadSmartTips = cache(async () => MOCK_SMART_TIPS);
const loadRecommended = cache(async () => MOCK_DEALS);

export const loadHomeData = cache(async () => {
  const [user, smartTips, recommended] = await Promise.all([
    loadUser(),
    loadSmartTips(),
    loadRecommended(),
  ]);

  return { user, smartTips, recommended };
});
