import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "@/lib/constants";

export interface PartyChatMessage {
  id: string;
  postId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  message: string;
  createdAt: string;
}

interface ProfileEmbed {
  display_name: string | null;
  avatar_url: string | null;
}

interface PartyChatMessageRow {
  id: string;
  post_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  profiles?: ProfileEmbed | ProfileEmbed[] | null;
}

const PARTY_CHAT_COLUMNS = [
  "id",
  "post_id",
  "sender_id",
  "message",
  "created_at",
  "profiles!party_chat_messages_sender_id_fkey(display_name, avatar_url)",
].join(", ");

function oneProfile(
  value: ProfileEmbed | ProfileEmbed[] | null | undefined
): ProfileEmbed | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function rowToMessage(
  row: PartyChatMessageRow,
  fallback?: { senderName?: string; senderAvatar?: string }
): PartyChatMessage {
  const profile = oneProfile(row.profiles);
  return {
    id: row.id,
    postId: row.post_id,
    senderId: row.sender_id,
    senderName:
      profile?.display_name?.trim() || fallback?.senderName || "여행자",
    senderAvatar:
      profile?.avatar_url?.trim() || fallback?.senderAvatar || "💬",
    message: row.message,
    createdAt: row.created_at,
  };
}

export async function fetchPartyChatMessages(
  supabase: SupabaseClient,
  postId: string
): Promise<PartyChatMessage[]> {
  const { data, error } = await supabase
    .from(TABLES.partyChatMessages)
    .select(PARTY_CHAT_COLUMNS)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error || !data) return [];
  return (data as unknown as PartyChatMessageRow[]).map((row) =>
    rowToMessage(row)
  );
}

export async function sendPartyChatMessage(
  supabase: SupabaseClient,
  payload: {
    postId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    message: string;
  }
): Promise<PartyChatMessage | null> {
  const { data, error } = await supabase
    .from(TABLES.partyChatMessages)
    .insert({
      post_id: payload.postId,
      sender_id: payload.senderId,
      message: payload.message.trim(),
    })
    .select(PARTY_CHAT_COLUMNS)
    .single();

  if (error || !data) {
    if (error) {
      console.error("[party-chat] send failed:", error.message);
    }
    return null;
  }
  return rowToMessage(data as unknown as PartyChatMessageRow, {
    senderName: payload.senderName,
    senderAvatar: payload.senderAvatar,
  });
}

export function subscribePartyChatMessages(
  supabase: SupabaseClient,
  postId: string,
  onInsert: (message: PartyChatMessage) => void
): RealtimeChannel {
  return supabase
    .channel(`party-chat:${postId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: TABLES.partyChatMessages,
        filter: `post_id=eq.${postId}`,
      },
      (payload) => {
        const row = payload.new as PartyChatMessageRow;
        if (!row?.id) return;
        onInsert(rowToMessage(row));
      }
    )
    .subscribe();
}
