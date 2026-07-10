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

interface PartyChatMessageRow {
  id: string;
  post_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  message: string;
  created_at: string;
}

const PARTY_CHAT_COLUMNS = [
  "id",
  "post_id",
  "sender_id",
  "sender_name",
  "sender_avatar",
  "message",
  "created_at",
].join(", ");

function rowToMessage(row: PartyChatMessageRow): PartyChatMessage {
  return {
    id: row.id,
    postId: row.post_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderAvatar: row.sender_avatar,
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
  return (data as unknown as PartyChatMessageRow[]).map(rowToMessage);
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
      sender_name: payload.senderName,
      sender_avatar: payload.senderAvatar,
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
  return rowToMessage(data as unknown as PartyChatMessageRow);
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
