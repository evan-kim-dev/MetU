import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { TABLES } from "@/lib/constants";
import {
  parseSplitChatPayload,
  type SplitChatMessage,
  type SplitChatSenderKind,
} from "@/lib/ledger/split-chat";

type RawInsert = {
  id?: string;
  thread_id?: string;
  sender_kind?: string;
  sender_user_id?: string | null;
  body?: string;
  payload?: unknown;
  created_at?: string;
};

function defaultName(kind: SplitChatSenderKind): string {
  if (kind === "agent") return "MetU AI";
  if (kind === "system") return "시스템";
  return "여행자";
}

export function rawRowToSplitChatMessage(
  row: RawInsert,
  senderName?: string
): SplitChatMessage | null {
  if (!row.id || !row.thread_id || !row.body || !row.created_at) return null;
  if (
    row.sender_kind !== "user" &&
    row.sender_kind !== "agent" &&
    row.sender_kind !== "system"
  ) {
    return null;
  }
  const kind = row.sender_kind;
  return {
    id: row.id,
    threadId: row.thread_id,
    senderKind: kind,
    senderUserId: row.sender_user_id ?? null,
    senderName:
      kind === "user"
        ? senderName?.trim() || defaultName(kind)
        : defaultName(kind),
    body: row.body,
    payload: parseSplitChatPayload(row.payload ?? null),
    createdAt: row.created_at,
  };
}

export function subscribeSplitChatMessages(
  supabase: SupabaseClient,
  threadId: string,
  onInsert: (message: SplitChatMessage) => void
): RealtimeChannel {
  return supabase
    .channel(`split-chat:${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: TABLES.tripSplitMessages,
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        const msg = rawRowToSplitChatMessage(payload.new as RawInsert);
        if (!msg) return;
        onInsert(msg);
      }
    )
    .subscribe();
}
