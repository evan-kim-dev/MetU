/**
 * DB / domain table names — keep in sync with Supabase migrations.
 * Never hardcode table strings in repositories or routes.
 */
export const TABLES = {
  trips: "trips",
  expenses: "expenses",
  profiles: "profiles",
  checklistItems: "checklist_items",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

/** localStorage keys (MVP until Auth+DB 연동) */
export const STORAGE_KEYS = {
  trips: "budgettrip-trips",
  profile: "budgettrip-profile",
  onboardingForm: "budgettrip-onboarding-form",
  tripPlan: "budgettrip-trip-plan",
  auth: "budgettrip-auth",
  communityPosts: "budgettrip-community-posts",
  guestAuthorId: "budgettrip-guest-author-id",
} as const;

/** App defaults */
export const DEFAULTS = {
  partySize: 2,
  dDayPlaceholder: 30,
  fxRefreshMs: 60_000,
} as const;

export const OPENAI = {
  defaultModel: "gpt-4o-mini",
  budgetInsightMaxTokens: 120,
  partyInsightMaxTokens: 140,
} as const;
