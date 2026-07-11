import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "@/lib/constants";

export type FriendshipStatus = "pending" | "accepted" | "rejected";

export interface FriendshipRow {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
}

export interface FriendSummary {
  id: string;
  name: string;
  avatar: string;
}

async function insertFriendNotification(
  supabase: SupabaseClient,
  input: {
    userId: string;
    type: "friend_request" | "friend_accepted" | "friend_rejected";
    actorId: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.from(TABLES.notifications).insert({
    user_id: input.userId,
    type: input.type,
    post_id: null,
    actor_id: input.actorId,
    payload: input.payload ?? {},
  });
}

export async function fetchFriendshipsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<FriendshipRow[]> {
  const { data, error } = await supabase
    .from(TABLES.friendships)
    .select("id, user_id, friend_id, status, created_at")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  if (error || !data) {
    if (error) console.error("[friendships] fetch failed:", error.message);
    return [];
  }
  return data as FriendshipRow[];
}

export function getAcceptedFriendIds(
  rows: FriendshipRow[],
  userId: string
): string[] {
  return rows
    .filter((row) => row.status === "accepted")
    .map((row) => (row.user_id === userId ? row.friend_id : row.user_id));
}

export function getOutgoingPendingIds(
  rows: FriendshipRow[],
  userId: string
): string[] {
  return rows
    .filter((row) => row.status === "pending" && row.user_id === userId)
    .map((row) => row.friend_id);
}

export function getIncomingPendingIds(
  rows: FriendshipRow[],
  userId: string
): string[] {
  return rows
    .filter((row) => row.status === "pending" && row.friend_id === userId)
    .map((row) => row.user_id);
}

export async function requestFriendInSupabase(
  supabase: SupabaseClient,
  userId: string,
  friendId: string,
  actorName: string
): Promise<"ok" | "pending" | "accepted" | "error"> {
  if (!userId || !friendId || userId === friendId) return "error";

  const { data: existingRows } = await supabase
    .from(TABLES.friendships)
    .select("id, user_id, friend_id, status")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  const existing = ((existingRows ?? []) as FriendshipRow[]).find(
    (row) =>
      (row.user_id === userId && row.friend_id === friendId) ||
      (row.user_id === friendId && row.friend_id === userId)
  );

  if (existing) {
    const row = existing;
    if (row.status === "accepted") return "accepted";
    if (row.status === "pending") {
      if (row.user_id === userId) return "pending";
      // 상대가 이미 나에게 요청한 경우 → 수락
      const accepted = await acceptFriendInSupabase(
        supabase,
        userId,
        friendId,
        actorName
      );
      return accepted ? "accepted" : "error";
    }
    if (row.status === "rejected") {
      const { error } = await supabase
        .from(TABLES.friendships)
        .update({
          user_id: userId,
          friend_id: friendId,
          status: "pending",
        })
        .eq("id", row.id);
      if (error) {
        console.error("[friendships] rerequest failed:", error.message);
        return "error";
      }
      await insertFriendNotification(supabase, {
        userId: friendId,
        type: "friend_request",
        actorId: userId,
        payload: { actorName },
      });
      return "ok";
    }
  }

  const { error } = await supabase.from(TABLES.friendships).insert({
    user_id: userId,
    friend_id: friendId,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") return "pending";
    console.error("[friendships] request failed:", error.message);
    return "error";
  }

  await insertFriendNotification(supabase, {
    userId: friendId,
    type: "friend_request",
    actorId: userId,
    payload: { actorName },
  });

  return "ok";
}

export async function acceptFriendInSupabase(
  supabase: SupabaseClient,
  userId: string,
  requesterId: string,
  actorName: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLES.friendships)
    .update({ status: "accepted" })
    .eq("user_id", requesterId)
    .eq("friend_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[friendships] accept failed:", error.message);
    return false;
  }

  await insertFriendNotification(supabase, {
    userId: requesterId,
    type: "friend_accepted",
    actorId: userId,
    payload: { actorName },
  });

  return true;
}

export async function rejectFriendInSupabase(
  supabase: SupabaseClient,
  userId: string,
  requesterId: string,
  actorName: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLES.friendships)
    .update({ status: "rejected" })
    .eq("user_id", requesterId)
    .eq("friend_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[friendships] reject failed:", error.message);
    return false;
  }

  await insertFriendNotification(supabase, {
    userId: requesterId,
    type: "friend_rejected",
    actorId: userId,
    payload: { actorName },
  });

  return true;
}

export async function removeFriendInSupabase(
  supabase: SupabaseClient,
  userId: string,
  friendId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.friendships)
    .delete()
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
    );

  if (error) {
    console.error("[friendships] remove failed:", error.message);
    return false;
  }
  return true;
}
