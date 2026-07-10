/**
 * DB / domain table names — keep in sync with Supabase migrations.
 * Never hardcode table strings in repositories or routes.
 */
export const TABLES = {
  trips: "trips",
  expenses: "expenses",
  profiles: "profiles",
  checklistItems: "checklist_items",
  communityPosts: "community_posts",
  postComments: "post_comments",
  postLikes: "post_likes",
  partyMembers: "party_members",
  partyChatMessages: "party_chat_messages",
  tripPlans: "trip_plans",
  budgetInsightLogs: "budget_insight_logs",
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
  partyChatMessages: "budgettrip-party-chat-messages",
  guestAuthorId: "budgettrip-guest-author-id",
  withactChecklistSession: "budgettrip-withact-checklist-session",
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
