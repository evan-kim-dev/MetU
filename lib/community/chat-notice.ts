const CHAT_LAST_SEEN_KEY = "budgettrip-chat-last-seen";

export type ChatLastSeenMap = Record<string, string>;

export function loadChatLastSeenMap(): ChatLastSeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CHAT_LAST_SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ChatLastSeenMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function markChatSeen(postId: string, seenAtIso = new Date().toISOString()): void {
  if (typeof window === "undefined") return;
  const prev = loadChatLastSeenMap();
  const next = { ...prev, [postId]: seenAtIso };
  localStorage.setItem(CHAT_LAST_SEEN_KEY, JSON.stringify(next));
}
