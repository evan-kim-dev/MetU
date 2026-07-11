import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { TABLES } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/community/storage";

export type AppNotificationType =
  | "party_join_request"
  | "party_join_accepted"
  | "party_join_rejected"
  | "friend_request"
  | "friend_accepted"
  | "friend_rejected";

export interface AppNotification {
  id: string;
  userId: string;
  type: AppNotificationType;
  postId: string | null;
  actorId: string | null;
  payload: {
    actorName?: string;
    postTitle?: string;
    [key: string]: unknown;
  };
  readAt: string | null;
  createdAt: string;
  createdAtLabel: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: AppNotificationType;
  post_id: string | null;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

const NOTIFICATION_COLUMNS = [
  "id",
  "user_id",
  "type",
  "post_id",
  "actor_id",
  "payload",
  "read_at",
  "created_at",
].join(", ");

function rowToNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    postId: row.post_id,
    actorId: row.actor_id,
    payload: (row.payload ?? {}) as AppNotification["payload"],
    readAt: row.read_at,
    createdAt: row.created_at,
    createdAtLabel: formatRelativeTime(row.created_at),
  };
}

export async function fetchNotificationsFromSupabase(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from(TABLES.notifications)
    .select(NOTIFICATION_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as unknown as NotificationRow[]).map(rowToNotification);
}

export async function fetchUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from(TABLES.notifications)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}

export async function markNotificationReadInSupabase(
  supabase: SupabaseClient,
  notificationId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.notifications)
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("read_at", null);

  return !error;
}

export async function markAllNotificationsReadInSupabase(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.notifications)
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  return !error;
}

export function subscribeNotifications(
  supabase: SupabaseClient,
  userId: string,
  onChange: () => void
): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: TABLES.notifications,
        filter: `user_id=eq.${userId}`,
      },
      () => onChange()
    )
    .subscribe();
}
