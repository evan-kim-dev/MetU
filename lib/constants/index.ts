/**
 * DB / domain table names — keep in sync with Supabase migrations.
 * Never hardcode table strings in repositories or routes.
 */
export const TABLES = {
  trips: "trips",
  profiles: "profiles",
  communityPosts: "community_posts",
  postComments: "post_comments",
  postLikes: "post_likes",
  commentLikes: "comment_likes",
  partyMembers: "party_members",
  partyChatMessages: "party_chat_messages",
  notifications: "notifications",
  friendships: "friendships",
  dmThreads: "dm_threads",
  dmMessages: "dm_messages",
  places: "places",
  tripMembers: "trip_members",
  tripInvites: "trip_invites",
  ledgerCardProfiles: "ledger_card_profiles",
  tripExpenses: "trip_expenses",
  tripExpenseShares: "trip_expense_shares",
  tripCashRates: "trip_cash_rates",
  fxRates: "fx_rates",
  tripSettlements: "trip_settlements",
  tripSettlementTransfers: "trip_settlement_transfers",
} as const;

/** localStorage keys (MVP until Auth+DB 연동) */
export const STORAGE_KEYS = {
  trips: "budgettrip-trips",
  profile: "budgettrip-profile",
  auth: "budgettrip-auth",
  communityPosts: "budgettrip-community-posts",
  partyChatMessages: "budgettrip-party-chat-messages",
  guestAuthorId: "budgettrip-guest-author-id",
  docsChecklist: "budgettrip-docs-checklist",
  countryMemories: "budgettrip-country-memories",
} as const;

/** App defaults */
export const DEFAULTS = {
  dDayPlaceholder: 30,
  fxRefreshMs: 60_000,
} as const;
