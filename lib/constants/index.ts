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
  commentLikes: "comment_likes",
  partyMembers: "party_members",
  partyChatMessages: "party_chat_messages",
  notifications: "notifications",
  friendships: "friendships",
  tripPlans: "trip_plans",
  budgetInsightLogs: "budget_insight_logs",
} as const;

/** localStorage keys (MVP until Auth+DB 연동) */
export const STORAGE_KEYS = {
  trips: "budgettrip-trips",
  profile: "budgettrip-profile",
  auth: "budgettrip-auth",
  communityPosts: "budgettrip-community-posts",
  partyChatMessages: "budgettrip-party-chat-messages",
  guestAuthorId: "budgettrip-guest-author-id",
  withactChecklistSession: "budgettrip-withact-checklist-session",
  docsChecklist: "budgettrip-docs-checklist",
} as const;

/** App defaults */
export const DEFAULTS = {
  dDayPlaceholder: 30,
  fxRefreshMs: 60_000,
} as const;
