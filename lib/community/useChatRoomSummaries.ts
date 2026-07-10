"use client";

import { useEffect, useState } from "react";
import { TABLES } from "@/lib/constants";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { loadChatLastSeenMap } from "./chat-notice";

type SummaryMap = Record<string, string>;
type CountMap = Record<string, number>;

interface ChatSummaryState {
  lastMessageByPostId: SummaryMap;
  lastTimeByPostId: SummaryMap;
  unreadCountByPostId: CountMap;
}

const INITIAL_SUMMARY: ChatSummaryState = {
  lastMessageByPostId: {},
  lastTimeByPostId: {},
  unreadCountByPostId: {},
};

export function useChatRoomSummaries(
  postIds: string[],
  enabled: boolean
): ChatSummaryState {
  const [summary, setSummary] = useState<ChatSummaryState>(INITIAL_SUMMARY);

  useEffect(() => {
    if (!enabled || postIds.length === 0) {
      setSummary(INITIAL_SUMMARY);
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) {
      setSummary(INITIAL_SUMMARY);
      return;
    }
    const sb: NonNullable<typeof supabase> = supabase;

    let cancelled = false;

    async function loadSummaries() {
      const { data, error } = await sb
        .from(TABLES.partyChatMessages)
        .select("post_id, message, created_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: false })
        .limit(300);

      if (cancelled || error || !data) return;

      const lastMessageByPostId: SummaryMap = {};
      const lastTimeByPostId: SummaryMap = {};
      const unreadCountByPostId: CountMap = {};
      const lastSeenMap = loadChatLastSeenMap();

      for (const row of data as Array<{ post_id: string; message: string; created_at: string }>) {
        if (!lastMessageByPostId[row.post_id]) {
          lastMessageByPostId[row.post_id] = row.message;
          lastTimeByPostId[row.post_id] = row.created_at;
        }

        const seenAt = lastSeenMap[row.post_id];
        if (!seenAt || new Date(row.created_at).getTime() > new Date(seenAt).getTime()) {
          unreadCountByPostId[row.post_id] = (unreadCountByPostId[row.post_id] ?? 0) + 1;
        }
      }

      if (!cancelled) {
        setSummary({
          lastMessageByPostId,
          lastTimeByPostId,
          unreadCountByPostId,
        });
      }
    }

    void loadSummaries();
    return () => {
      cancelled = true;
    };
  }, [enabled, postIds]);

  return summary;
}
