import type { User } from "@supabase/supabase-js";
import { STORAGE_KEYS } from "@/lib/constants";

export function getOrCreateGuestAuthorId(): string {
  if (typeof window === "undefined") return "guest-server";

  const existing = localStorage.getItem(STORAGE_KEYS.guestAuthorId);
  if (existing) return existing;

  const id = `guest-${crypto.randomUUID()}`;
  localStorage.setItem(STORAGE_KEYS.guestAuthorId, id);
  return id;
}

export function resolveAuthorId(
  user: User | null,
  provider: "kakao" | "guest" | "supabase" | null
): string {
  if (user?.id) return user.id;
  if (provider === "guest") return getOrCreateGuestAuthorId();
  return getOrCreateGuestAuthorId();
}
