import { STORAGE_KEYS } from "@/lib/constants";
import type { DocsCountryId } from "@/lib/checklist/resolve-docs-country";

export interface StoredDocUpload {
  id: string;
  name: string;
  url: string;
}

export interface DocsChecklistPersistedState {
  checkedMap: Record<string, boolean>;
  uploads: Record<string, StoredDocUpload[]>;
}

type DocsChecklistStore = Record<string, DocsChecklistPersistedState>;

export function getDocsChecklistScopeKey(
  country: DocsCountryId,
  tripId?: string | null
): string {
  return `${tripId ?? "global"}:${country}`;
}

function readStore(): DocsChecklistStore {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.docsChecklist);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DocsChecklistStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: DocsChecklistStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.docsChecklist, JSON.stringify(store));
}

export function loadDocsChecklistState(
  scopeKey: string
): DocsChecklistPersistedState | null {
  const store = readStore();
  return store[scopeKey] ?? null;
}

export function saveDocsChecklistState(
  scopeKey: string,
  state: DocsChecklistPersistedState
) {
  const store = readStore();
  store[scopeKey] = state;
  writeStore(store);
}
