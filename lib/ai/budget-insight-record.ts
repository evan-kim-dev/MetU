export type BudgetInsightSource = "local" | "fallback" | "ai+rag";

export type BudgetInsightRecord = {
  budget: number;
  month: number;
  insight: string;
  source: BudgetInsightSource;
  localFallback: string;
  rag: {
    bandId: string;
    allowedRegions: string[];
    contexts: string[];
    seasonTip: string;
    recommendedNights: string;
  };
  createdAt: string;
};
