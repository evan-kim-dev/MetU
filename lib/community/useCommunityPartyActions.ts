"use client";

import { useCallback } from "react";
import {
  acceptPartyMemberInSupabase,
  cancelJoinRequestInSupabase,
  fetchCommunityPostsFromSupabase,
  joinPartyInSupabase,
  leavePartyInSupabase,
  rejectPartyMemberInSupabase,
} from "@/lib/community/supabase";
import type { CommunityPost } from "@/lib/community/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type SetPosts = React.Dispatch<React.SetStateAction<CommunityPost[]>>;

interface UseCommunityPartyActionsParams {
  setPosts: SetPosts;
  useDb: boolean;
  userId: string | null | undefined;
  authorId: string;
  profileName: string;
}

export function useCommunityPartyActions({
  setPosts,
  useDb,
  userId,
  authorId,
  profileName,
}: UseCommunityPartyActionsParams) {
  const isPartyJoined = useCallback(
    (post: CommunityPost) =>
      Boolean(
        post.party?.members.some(
          (member) =>
            member.id === authorId &&
            (member.isHost ||
              member.status === "accepted" ||
              member.status == null)
        )
      ),
    [authorId]
  );

  const isPartyPending = useCallback(
    (post: CommunityPost) =>
      Boolean(
        post.party?.pendingMembers?.some((member) => member.id === authorId)
      ),
    [authorId]
  );

  const isPartyHost = useCallback(
    (post: CommunityPost) => post.authorId === authorId,
    [authorId]
  );

  const isPartyFull = useCallback(
    (post: CommunityPost) =>
      Boolean(post.party && post.party.current >= post.party.needed),
    []
  );

  const joinParty = useCallback(
    (postId: string) => {
      if (!useDb || !userId) return false;

      let requested = false;
      const now = new Date().toISOString();

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId || !post.party) return post;
          if (post.authorId === authorId) return post;
          if (post.party.members.some((member) => member.id === authorId)) {
            return post;
          }
          if (
            post.party.pendingMembers?.some((member) => member.id === authorId)
          ) {
            return post;
          }
          if (post.party.current >= post.party.needed) return post;

          requested = true;
          const pendingMembers = [
            ...(post.party.pendingMembers ?? []),
            {
              id: authorId,
              name: profileName,
              avatar: "🧑",
              joinedAtIso: now,
              status: "pending" as const,
            },
          ];
          return {
            ...post,
            party: {
              ...post.party,
              pendingMembers,
            },
          };
        })
      );

      if (requested) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void (async () => {
            const ok = await joinPartyInSupabase(
              supabase,
              postId,
              authorId,
              profileName,
              "🧑"
            );
            if (!ok) {
              const remote = await fetchCommunityPostsFromSupabase(supabase);
              setPosts(remote);
            }
          })();
        }
      }
      return requested;
    },
    [authorId, profileName, setPosts, useDb, userId]
  );

  const cancelJoinRequest = useCallback(
    (postId: string) => {
      let cancelled = false;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId || !post.party) return post;
          const pending = post.party.pendingMembers ?? [];
          if (!pending.some((member) => member.id === authorId)) return post;

          cancelled = true;
          return {
            ...post,
            party: {
              ...post.party,
              pendingMembers: pending.filter(
                (member) => member.id !== authorId
              ),
            },
          };
        })
      );

      if (cancelled && useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void cancelJoinRequestInSupabase(supabase, postId, authorId);
        }
      }
      return cancelled;
    },
    [authorId, setPosts, useDb, userId]
  );

  const acceptJoin = useCallback(
    (postId: string, memberId: string) => {
      if (!useDb || !userId) return false;
      let accepted = false;
      const now = new Date().toISOString();

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId || !post.party) return post;
          if (post.authorId !== authorId) return post;
          if (post.party.current >= post.party.needed) return post;

          const pending = post.party.pendingMembers ?? [];
          const target = pending.find((m) => m.id === memberId);
          if (!target) return post;

          accepted = true;
          const members = [
            ...post.party.members,
            {
              ...target,
              status: "accepted" as const,
              joinedAtIso: now,
            },
          ];
          return {
            ...post,
            party: {
              ...post.party,
              members,
              current: members.length,
              pendingMembers: pending.filter((m) => m.id !== memberId),
            },
          };
        })
      );

      if (accepted) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void (async () => {
            const ok = await acceptPartyMemberInSupabase(
              supabase,
              postId,
              authorId,
              memberId
            );
            if (!ok) {
              const remote = await fetchCommunityPostsFromSupabase(supabase);
              setPosts(remote);
            }
          })();
        }
      }
      return accepted;
    },
    [authorId, setPosts, useDb, userId]
  );

  const rejectJoin = useCallback(
    (postId: string, memberId: string) => {
      if (!useDb || !userId) return false;
      let rejected = false;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId || !post.party) return post;
          if (post.authorId !== authorId) return post;

          const pending = post.party.pendingMembers ?? [];
          if (!pending.some((m) => m.id === memberId)) return post;

          rejected = true;
          return {
            ...post,
            party: {
              ...post.party,
              pendingMembers: pending.filter((m) => m.id !== memberId),
            },
          };
        })
      );

      if (rejected) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void (async () => {
            const ok = await rejectPartyMemberInSupabase(
              supabase,
              postId,
              authorId,
              memberId
            );
            if (!ok) {
              const remote = await fetchCommunityPostsFromSupabase(supabase);
              setPosts(remote);
            }
          })();
        }
      }
      return rejected;
    },
    [authorId, setPosts, useDb, userId]
  );

  const leaveParty = useCallback(
    (postId: string) => {
      let left = false;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId || !post.party) return post;
          if (post.authorId === authorId) return post;
          if (!post.party.members.some((member) => member.id === authorId)) {
            return post;
          }

          left = true;
          const members = post.party.members.filter(
            (member) => member.id !== authorId
          );
          return {
            ...post,
            party: {
              ...post.party,
              members,
              current: members.length,
            },
          };
        })
      );

      if (left && useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void (async () => {
            await leavePartyInSupabase(supabase, postId, authorId);
          })();
        }
      }
      return left;
    },
    [authorId, setPosts, useDb, userId]
  );

  return {
    joinParty,
    leaveParty,
    cancelJoinRequest,
    acceptJoin,
    rejectJoin,
    isPartyJoined,
    isPartyPending,
    isPartyHost,
    isPartyFull,
  };
}
