import { STORAGE_KEYS } from "@/lib/constants";
import type { PartyChatMessage } from "@/lib/community/chat-supabase";

type ChatStore = Record<string, PartyChatMessage[]>;

function loadStore(): ChatStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.partyChatMessages);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ChatStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: ChatStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.partyChatMessages, JSON.stringify(store));
}

export function loadLocalPartyChatMessages(postId: string): PartyChatMessage[] {
  const store = loadStore();
  return [...(store[postId] ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function appendLocalPartyChatMessage(message: PartyChatMessage) {
  const store = loadStore();
  const list = store[message.postId] ?? [];
  if (list.some((item) => item.id === message.id)) return;
  store[message.postId] = [...list, message];
  saveStore(store);
}

export function mergePartyChatMessages(
  remote: PartyChatMessage[],
  local: PartyChatMessage[]
): PartyChatMessage[] {
  const byId = new Map<string, PartyChatMessage>();
  for (const message of [...remote, ...local]) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function createLocalPartyChatMessage(input: {
  postId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  message: string;
}): PartyChatMessage {
  return {
    id: `local-${crypto.randomUUID()}`,
    postId: input.postId,
    senderId: input.senderId,
    senderName: input.senderName,
    senderAvatar: input.senderAvatar,
    message: input.message.trim(),
    createdAt: new Date().toISOString(),
  };
}
