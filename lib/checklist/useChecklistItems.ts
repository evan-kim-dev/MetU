"use client";

import { useCallback } from "react";
import type { ChecklistItemInput } from "@/lib/checklist/types";

/**
 * Temporary shim until P6-B (Supabase checklist_items).
 * Always empty / no-op — screens keep working with localStorage docs state.
 */
export function useChecklistItems(_tripId?: string | null) {
  const persistItem = useCallback(async (_input: ChecklistItemInput) => false, []);

  return {
    items: [] as ChecklistItemInput[],
    status: "disabled" as const,
    persistItem,
  };
}
