import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "@/lib/constants";

export interface DmThread {
  id: string;
  userLow: string;
  userHigh: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface DmMessage {
  id: string;
  threadId: string;
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

interface DmThreadRow {
  id: string;
  user_low: string;
  user_high: string;
  created_at: string;
  last_message_at: string;
}

interface DmMessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  profiles?: ProfileEmbed | ProfileEmbed[] | null;
}

const DM_MESSAGE_COLUMNS = [
  "id",
  "thread_id",
  "sender_id",
  "message",
  "created_at",
  "profiles!dm_messages_sender_id_fkey(display_name, avatar_url)",
].join(", ");

function oneProfile(
  value: ProfileEmbed | ProfileEmbed[] | null | undefined
): ProfileEmbed | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function orderedPair(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

function rowToThread(row: DmThreadRow): DmThread {
  return {
    id: row.id,
    userLow: row.user_low,
    userHigh: row.user_high,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
  };
}

function rowToMessage(
  row: DmMessageRow,
  fallback?: { senderName?: string; senderAvatar?: string }
): DmMessage {
  const profile = oneProfile(row.profiles);
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    senderName:
      profile?.display_name?.trim() || fallback?.senderName || "여행자",
    senderAvatar:
      profile?.avatar_url?.trim() || fallback?.senderAvatar || "💬",
    message: row.message,
    createdAt: row.created_at,
  };
}

export async function getOrCreateDmThread(
  supabase: SupabaseClient,
  me: string,
  peer: string
): Promise<DmThread | null> {
  if (!me || !peer || me === peer) return null;
  const { low, high } = orderedPair(me, peer);

  const existing = await supabase
    .from(TABLES.dmThreads)
    .select("id, user_low, user_high, created_at, last_message_at")
    .eq("user_low", low)
    .eq("user_high", high)
    .maybeSingle();

  if (existing.data) {
    return rowToThread(existing.data as DmThreadRow);
  }

  const inserted = await supabase
    .from(TABLES.dmThreads)
    .insert({ user_low: low, user_high: high })
    .select("id, user_low, user_high, created_at, last_message_at")
    .single();

  if (inserted.data) {
    return rowToThread(inserted.data as DmThreadRow);
  }

  // race: another client created it
  const again = await supabase
    .from(TABLES.dmThreads)
    .select("id, user_low, user_high, created_at, last_message_at")
    .eq("user_low", low)
    .eq("user_high", high)
    .maybeSingle();

  if (again.data) return rowToThread(again.data as DmThreadRow);
  if (inserted.error) {
    console.error("[dm] getOrCreate thread failed:", inserted.error.message);
  }
  return null;
}

export async function fetchDmMessages(
  supabase: SupabaseClient,
  threadId: string
): Promise<DmMessage[]> {
  const { data, error } = await supabase
    .from(TABLES.dmMessages)
    .select(DM_MESSAGE_COLUMNS)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error || !data) {
    if (error) console.error("[dm] fetch failed:", error.message);
    return [];
  }
  return (data as unknown as DmMessageRow[]).map((row) => rowToMessage(row));
}

export async function sendDmMessage(
  supabase: SupabaseClient,
  payload: {
    threadId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    message: string;
  }
): Promise<DmMessage | null> {
  const { data, error } = await supabase
    .from(TABLES.dmMessages)
    .insert({
      thread_id: payload.threadId,
      sender_id: payload.senderId,
      message: payload.message.trim(),
    })
    .select(DM_MESSAGE_COLUMNS)
    .single();

  if (error || !data) {
    if (error) console.error("[dm] send failed:", error.message);
    return null;
  }
  return rowToMessage(data as unknown as DmMessageRow, {
    senderName: payload.senderName,
    senderAvatar: payload.senderAvatar,
  });
}

export function subscribeDmMessages(
  supabase: SupabaseClient,
  threadId: string,
  onInsert: (message: DmMessage) => void
): RealtimeChannel {
  return supabase
    .channel(`dm-chat:${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: TABLES.dmMessages,
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        const row = payload.new as DmMessageRow;
        if (!row?.id) return;
        onInsert(rowToMessage(row));
      }
    )
    .subscribe();
}

export function dmChatSeenKey(threadId: string): string {
  return `dm:${threadId}`;
}

export async function notifyDmMessage(
  supabase: SupabaseClient,
  input: {
    recipientId: string;
    actorId: string;
    actorName: string;
    threadId: string;
    preview: string;
  }
): Promise<void> {
  if (!input.recipientId || input.recipientId === input.actorId) return;
  const { error } = await supabase.from(TABLES.notifications).insert({
    user_id: input.recipientId,
    type: "dm_message",
    post_id: null,
    actor_id: input.actorId,
    payload: {
      actorName: input.actorName,
      preview: input.preview,
      threadId: input.threadId,
    },
  });
  if (error) {
    console.error("[dm] notify failed:", error.message);
  }
}
