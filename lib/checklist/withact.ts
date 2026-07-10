import type { AuthUser } from "@/lib/auth/types";
import { getOrCreateGuestAuthorId } from "@/lib/community/author";
import { STORAGE_KEYS } from "@/lib/constants";

export type WithactItemType = "FLIGHT" | "HOTEL" | "DOCUMENT" | "EXTRA";
export type WithactItemStatus =
  | "NOT_STARTED"
  | "SEARCHED"
  | "SELECTED"
  | "COMPLETED";

export interface WithactChecklistSession {
  guestId: string;
  budgetId: number;
  requiredItemId: number;
}

export interface SaveWithactChecklistItemInput {
  itemType: WithactItemType;
  itemStatus: WithactItemStatus;
  itemName: string;
  itemSummary?: string;
  externalProvider?: string;
  externalItemId?: string;
  externalUrl?: string;
  selected?: boolean;
}

interface SessionResponse {
  guestId: string;
  budgetId: number;
  requiredItemId: number;
  source?: string;
  error?: string;
}

interface DetailsResponse {
  details?: Array<Record<string, unknown>>;
  error?: string;
}

export function resolveWithactGuestId(user: AuthUser | null): string {
  if (user?.id) return `user-${user.id}`;
  return getOrCreateGuestAuthorId();
}

function loadCachedSession(guestId: string): WithactChecklistSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.withactChecklistSession);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WithactChecklistSession;
    if (parsed.guestId !== guestId) return null;
    if (!parsed.budgetId || !parsed.requiredItemId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedSession(session: WithactChecklistSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEYS.withactChecklistSession,
    JSON.stringify(session)
  );
}

export async function ensureWithactChecklistSession(
  guestId: string,
  totalBudget = 0
): Promise<WithactChecklistSession | null> {
  const cached = loadCachedSession(guestId);
  if (cached) return cached;

  try {
    const res = await fetch("/api/checklist/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId, totalBudget }),
      cache: "no-store",
    });
    const data = (await res.json()) as SessionResponse;
    if (!res.ok || !data.budgetId || !data.requiredItemId) return null;

    const session: WithactChecklistSession = {
      guestId: data.guestId ?? guestId,
      budgetId: data.budgetId,
      requiredItemId: data.requiredItemId,
    };
    saveCachedSession(session);
    return session;
  } catch {
    return null;
  }
}

export async function saveWithactChecklistItem(
  session: WithactChecklistSession,
  input: SaveWithactChecklistItemInput
): Promise<boolean> {
  try {
    const res = await fetch("/api/checklist/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestId: session.guestId,
        budgetId: session.budgetId,
        requiredItemId: session.requiredItemId,
        ...input,
      }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadWithactChecklistDetails(
  session: WithactChecklistSession
): Promise<Array<Record<string, unknown>>> {
  try {
    const params = new URLSearchParams({
      requiredItemId: String(session.requiredItemId),
    });
    const res = await fetch(`/api/checklist/details?${params.toString()}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as DetailsResponse;
    if (!res.ok) return [];
    return data.details ?? [];
  } catch {
    return [];
  }
}
