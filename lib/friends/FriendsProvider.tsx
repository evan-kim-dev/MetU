"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { fetchAuthorProfilesByIds } from "@/lib/profile/enrich-author-avatars";
import { isAvatarImage } from "@/lib/profile/public";
import {
  acceptFriendInSupabase,
  fetchFriendshipsForUser,
  getAcceptedFriendIds,
  getIncomingPendingIds,
  getOutgoingPendingIds,
  rejectFriendInSupabase,
  removeFriendInSupabase,
  requestFriendInSupabase,
  type FriendSummary,
} from "@/lib/friends/supabase";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface FriendsContextValue {
  friends: FriendSummary[];
  friendIds: Set<string>;
  pendingOutgoingIds: Set<string>;
  pendingIncomingIds: Set<string>;
  isReady: boolean;
  isFriend: (friendId: string) => boolean;
  isPendingOutgoing: (friendId: string) => boolean;
  requestFriend: (friendId: string) => Promise<boolean>;
  acceptFriend: (requesterId: string) => Promise<boolean>;
  rejectFriend: (requesterId: string) => Promise<boolean>;
  removeFriend: (friendId: string) => Promise<boolean>;
  refreshFriends: () => Promise<void>;
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { user, provider, isReady: isAuthReady } = useAuth();
  const { profile } = useProfile();
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [pendingOutgoingIds, setPendingOutgoingIds] = useState<Set<string>>(
    new Set()
  );
  const [pendingIncomingIds, setPendingIncomingIds] = useState<Set<string>>(
    new Set()
  );
  const [isReady, setIsReady] = useState(false);

  const userId = user?.id ?? null;
  const useDb = Boolean(userId) && provider !== "guest";

  const refreshFriends = useCallback(async () => {
    if (!userId || !useDb) {
      setFriends([]);
      setPendingOutgoingIds(new Set());
      setPendingIncomingIds(new Set());
      setIsReady(true);
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) {
      setFriends([]);
      setPendingOutgoingIds(new Set());
      setPendingIncomingIds(new Set());
      setIsReady(true);
      return;
    }

    const rows = await fetchFriendshipsForUser(supabase, userId);
    const acceptedIds = getAcceptedFriendIds(rows, userId);
    const outgoing = getOutgoingPendingIds(rows, userId);
    const incoming = getIncomingPendingIds(rows, userId);

    const profiles = await fetchAuthorProfilesByIds([
      ...acceptedIds,
      ...outgoing,
      ...incoming,
    ]);

    setFriends(
      acceptedIds.map((id) => {
        const p = profiles[id];
        const avatar = p?.avatarUrl?.trim() || "";
        return {
          id,
          name: p?.name?.trim() || "여행자",
          avatar: isAvatarImage(avatar) ? avatar : avatar || "👤",
        };
      })
    );
    setPendingOutgoingIds(new Set(outgoing));
    setPendingIncomingIds(new Set(incoming));
    setIsReady(true);
  }, [useDb, userId]);

  useEffect(() => {
    if (!isAuthReady) return;
    void refreshFriends();
  }, [isAuthReady, refreshFriends]);

  const friendIds = useMemo(
    () => new Set(friends.map((friend) => friend.id)),
    [friends]
  );

  const isFriend = useCallback(
    (friendId: string) => friendIds.has(friendId),
    [friendIds]
  );

  const isPendingOutgoing = useCallback(
    (friendId: string) => pendingOutgoingIds.has(friendId),
    [pendingOutgoingIds]
  );

  const requestFriend = useCallback(
    async (friendId: string) => {
      if (!userId || !useDb || !friendId || friendId === userId) return false;
      const supabase = getBrowserSupabase();
      if (!supabase) return false;

      const result = await requestFriendInSupabase(
        supabase,
        userId,
        friendId,
        profile.name || "여행자"
      );
      if (result === "error") return false;
      await refreshFriends();
      return true;
    },
    [profile.name, refreshFriends, useDb, userId]
  );

  const acceptFriend = useCallback(
    async (requesterId: string) => {
      if (!userId || !useDb || !requesterId) return false;
      const supabase = getBrowserSupabase();
      if (!supabase) return false;

      const ok = await acceptFriendInSupabase(
        supabase,
        userId,
        requesterId,
        profile.name || "여행자"
      );
      if (!ok) return false;
      await refreshFriends();
      return true;
    },
    [profile.name, refreshFriends, useDb, userId]
  );

  const rejectFriend = useCallback(
    async (requesterId: string) => {
      if (!userId || !useDb || !requesterId) return false;
      const supabase = getBrowserSupabase();
      if (!supabase) return false;

      const ok = await rejectFriendInSupabase(
        supabase,
        userId,
        requesterId,
        profile.name || "여행자"
      );
      if (!ok) return false;
      await refreshFriends();
      return true;
    },
    [profile.name, refreshFriends, useDb, userId]
  );

  const removeFriend = useCallback(
    async (friendId: string) => {
      if (!userId || !useDb || !friendId) return false;
      const supabase = getBrowserSupabase();
      if (!supabase) return false;

      const ok = await removeFriendInSupabase(supabase, userId, friendId);
      if (!ok) return false;
      await refreshFriends();
      return true;
    },
    [refreshFriends, useDb, userId]
  );

  const value = useMemo(
    () => ({
      friends,
      friendIds,
      pendingOutgoingIds,
      pendingIncomingIds,
      isReady,
      isFriend,
      isPendingOutgoing,
      requestFriend,
      acceptFriend,
      rejectFriend,
      removeFriend,
      refreshFriends,
    }),
    [
      acceptFriend,
      friendIds,
      friends,
      isFriend,
      isPendingOutgoing,
      isReady,
      pendingIncomingIds,
      pendingOutgoingIds,
      refreshFriends,
      rejectFriend,
      removeFriend,
      requestFriend,
    ]
  );

  return (
    <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>
  );
}

export function useFriends() {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error("useFriends must be used within FriendsProvider");
  }
  return context;
}
