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
import { resolveAuthorId } from "@/lib/community/author";
import {
  formatRelativeTime,
  loadCommunityPosts,
  saveCommunityPosts,
} from "@/lib/community/storage";
import {
  acceptPartyMemberInSupabase,
  cancelJoinRequestInSupabase,
  deleteCommunityPostFromSupabase,
  deletePostCommentFromSupabase,
  fetchCommunityPostsFromSupabase,
  insertCommunityPostToSupabase,
  insertPostCommentToSupabase,
  joinPartyInSupabase,
  leavePartyInSupabase,
  rejectPartyMemberInSupabase,
  togglePostLikeInSupabase,
  updateCommunityPostInSupabase,
  updatePostCommentInSupabase,
} from "@/lib/community/supabase";
import type {
  CommunityPost,
  CreatePostInput,
  PostComment,
  UpdatePostInput,
} from "@/lib/community/types";
import { syncPostCounts } from "@/lib/community/counts";
import { STORAGE_KEYS } from "@/lib/constants";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface CommunityStateContextValue {
  posts: CommunityPost[];
  isReady: boolean;
}

interface CommunityActionContextValue {
  getPost: (id: string) => CommunityPost | undefined;
  addPost: (input: CreatePostInput) => CommunityPost;
  updatePost: (id: string, input: UpdatePostInput) => boolean;
  removePost: (id: string) => boolean;
  canEdit: (post: CommunityPost) => boolean;
  canDelete: (post: CommunityPost) => boolean;
  toggleLike: (postId: string) => void;
  isLiked: (post: CommunityPost) => boolean;
  addComment: (postId: string, content: string) => boolean;
  updateComment: (postId: string, commentId: string, content: string) => boolean;
  removeComment: (postId: string, commentId: string) => boolean;
  canManageComment: (comment: PostComment) => boolean;
  joinParty: (postId: string) => boolean;
  leaveParty: (postId: string) => boolean;
  cancelJoinRequest: (postId: string) => boolean;
  acceptJoin: (postId: string, memberId: string) => boolean;
  rejectJoin: (postId: string, memberId: string) => boolean;
  isPartyJoined: (post: CommunityPost) => boolean;
  isPartyPending: (post: CommunityPost) => boolean;
  isPartyHost: (post: CommunityPost) => boolean;
  isPartyFull: (post: CommunityPost) => boolean;
}

export type CommunityContextValue = CommunityStateContextValue &
  CommunityActionContextValue;

const CommunityStateContext = createContext<CommunityStateContextValue | null>(null);
const CommunityActionContext = createContext<CommunityActionContextValue | null>(null);

function hasPersistedLocalPosts(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(STORAGE_KEYS.communityPosts));
}

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const { user, provider, isReady: isAuthReady } = useAuth();
  const { profile } = useProfile();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isReady, setIsReady] = useState(false);

  const userId = user?.id ?? null;
  const useDb = Boolean(userId) && provider !== "guest";

  useEffect(() => {
    if (!isAuthReady) return;

    let cancelled = false;

    async function load() {
      if (!useDb || !userId) {
        if (!cancelled) {
          setPosts(loadCommunityPosts());
          setIsReady(true);
        }
        return;
      }

      const supabase = getBrowserSupabase();
      if (!supabase) {
        if (!cancelled) {
          setPosts(loadCommunityPosts());
          setIsReady(true);
        }
        return;
      }

      let remote = await fetchCommunityPostsFromSupabase(supabase);

      if (remote.length === 0 && hasPersistedLocalPosts()) {
        const local = loadCommunityPosts();
        await Promise.all(
          local.map((post) =>
            insertCommunityPostToSupabase(
            supabase,
            userId,
            profile.name,
            post.avatar,
            {
              category: post.category,
              title: post.title,
              destination: post.destination,
              body: post.preview,
              imageUrls: post.images,
              party: post.party,
            }
          )
          )
        );
        remote = await fetchCommunityPostsFromSupabase(supabase);
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEYS.communityPosts);
        }
      }

      if (!cancelled) {
        setPosts(remote.length > 0 ? remote : loadCommunityPosts());
        setIsReady(true);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, useDb, userId]);

  useEffect(() => {
    if (!isReady || useDb) return;
    saveCommunityPosts(posts.map(syncPostCounts));
  }, [posts, isReady, useDb]);

  const authorId = useMemo(
    () => resolveAuthorId(user, provider),
    [provider, user]
  );

  const getPost = useCallback(
    (id: string) => posts.find((post) => post.id === id),
    [posts]
  );

  const canEdit = useCallback(
    (post: CommunityPost) => post.authorId === authorId,
    [authorId]
  );

  const canDelete = useCallback(
    (post: CommunityPost) => post.authorId === authorId,
    [authorId]
  );

  const addPost = useCallback(
    (input: CreatePostInput): CommunityPost => {
      const now = new Date().toISOString();
      const avatarEmoji =
        input.category === "party"
          ? "🎮"
          : input.category === "review"
            ? "🌏"
            : input.category === "tip"
              ? "💡"
              : "✈️";

      const optimistic: CommunityPost = {
        id: `post-${crypto.randomUUID()}`,
        category: input.category,
        authorId,
        author: profile.name,
        avatar: avatarEmoji,
        destination: input.destination.trim(),
        title: input.title.trim(),
        preview: input.body.trim(),
        images: input.imageUrls ?? [],
        likes: 0,
        comments: 0,
        likedBy: [],
        commentList: [],
        createdAt: formatRelativeTime(now),
        createdAtIso: now,
        party: input.party
          ? {
              ...input.party,
              members: [
                {
                  id: authorId,
                  name: profile.name,
                  avatar: avatarEmoji,
                  joinedAtIso: now,
                  isHost: true,
                },
              ],
              current: 1,
            }
          : undefined,
      };

      setPosts((prev) => [optimistic, ...prev]);

      if (useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void (async () => {
            const saved = await insertCommunityPostToSupabase(
              supabase,
              authorId,
              profile.name,
              avatarEmoji,
              input
            );
            if (saved) {
              setPosts((prev) =>
                prev.map((post) => (post.id === optimistic.id ? saved : post))
              );
            }
          })();
        }
      }

      return optimistic;
    },
    [authorId, profile.name, useDb, userId]
  );

  const removePost = useCallback(
    (id: string) => {
      const target = posts.find((post) => post.id === id);
      if (!target || target.authorId !== authorId) return false;

      setPosts((prev) => prev.filter((post) => post.id !== id));

      if (useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void deleteCommunityPostFromSupabase(supabase, id, authorId);
        }
      }
      return true;
    },
    [authorId, posts, useDb, userId]
  );

  const updatePost = useCallback(
    (id: string, input: UpdatePostInput) => {
      const target = posts.find((post) => post.id === id);
      if (!target || target.authorId !== authorId) return false;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== id) return post;

          const nextParty = input.party
            ? {
                startDate: input.party.startDate,
                endDate: input.party.endDate,
                needed: input.party.needed,
                budgetPerPerson: input.party.budgetPerPerson,
                members:
                  input.party.members ??
                  post.party?.members ??
                  [
                    {
                      id: authorId,
                      name: profile.name,
                      avatar: post.avatar,
                      joinedAtIso: post.createdAtIso,
                      isHost: true,
                    },
                  ],
                current:
                  input.party.members?.length ??
                  post.party?.members.length ??
                  1,
              }
            : undefined;

          return syncPostCounts({
            ...post,
            category: input.category,
            destination: input.destination.trim(),
            title: input.title.trim(),
            preview: input.body.trim(),
            images: input.imageUrls ?? post.images ?? [],
            party: nextParty,
          });
        })
      );

      if (useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void (async () => {
            const saved = await updateCommunityPostInSupabase(
              supabase,
              id,
              authorId,
              input
            );
            if (saved) {
              setPosts((prev) =>
                prev.map((post) => (post.id === id ? saved : post))
              );
            }
          })();
        }
      }
      return true;
    },
    [authorId, posts, profile.name, useDb, userId]
  );

  const isLiked = useCallback(
    (post: CommunityPost) => post.likedBy.includes(authorId),
    [authorId]
  );

  const toggleLike = useCallback(
    (postId: string) => {
      let wasLiked = false;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          wasLiked = post.likedBy.includes(authorId);
          if (wasLiked) {
            return syncPostCounts({
              ...post,
              likedBy: post.likedBy.filter((id) => id !== authorId),
              likes: Math.max(0, post.likes - 1),
            });
          }
          return syncPostCounts({
            ...post,
            likedBy: [...post.likedBy, authorId],
            likes: post.likes + 1,
          });
        })
      );

      if (useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void togglePostLikeInSupabase(supabase, postId, authorId, wasLiked);
        }
      }
    },
    [authorId, useDb, userId]
  );

  const addComment = useCallback(
    (postId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return false;

      const now = new Date().toISOString();
      const optimisticId = `comment-${crypto.randomUUID()}`;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const comment = {
            id: optimisticId,
            authorId,
            author: profile.name,
            avatar: "💬",
            content: trimmed,
            createdAt: formatRelativeTime(now),
            createdAtIso: now,
          };
          return syncPostCounts({
            ...post,
            commentList: [...post.commentList, comment],
          });
        })
      );

      if (useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void (async () => {
            const saved = await insertPostCommentToSupabase(
              supabase,
              postId,
              authorId,
              profile.name,
              trimmed
            );
            if (saved) {
              setPosts((prev) =>
                prev.map((post) => {
                  if (post.id !== postId) return post;
                  return syncPostCounts({
                    ...post,
                    commentList: post.commentList.map((c) =>
                      c.id === optimisticId ? saved : c
                    ),
                  });
                })
              );
            }
          })();
        }
      }
      return true;
    },
    [authorId, profile.name, useDb, userId]
  );

  const canManageComment = useCallback(
    (comment: PostComment) => comment.authorId === authorId,
    [authorId]
  );

  const updateComment = useCallback(
    (postId: string, commentId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return false;

      let updated = false;
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const target = post.commentList.find(
            (comment) => comment.id === commentId
          );
          if (!target || target.authorId !== authorId) return post;

          updated = true;
          return syncPostCounts({
            ...post,
            commentList: post.commentList.map((comment) =>
              comment.id === commentId
                ? { ...comment, content: trimmed }
                : comment
            ),
          });
        })
      );

      if (updated && useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void updatePostCommentInSupabase(
            supabase,
            commentId,
            authorId,
            trimmed
          );
        }
      }
      return updated;
    },
    [authorId, useDb, userId]
  );

  const removeComment = useCallback(
    (postId: string, commentId: string) => {
      let removed = false;
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const target = post.commentList.find(
            (comment) => comment.id === commentId
          );
          if (!target || target.authorId !== authorId) return post;

          removed = true;
          return syncPostCounts({
            ...post,
            commentList: post.commentList.filter(
              (comment) => comment.id !== commentId
            ),
          });
        })
      );

      if (removed && useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void deletePostCommentFromSupabase(supabase, commentId, authorId);
        }
      }
      return removed;
    },
    [authorId, useDb, userId]
  );

  const isPartyJoined = useCallback(
    (post: CommunityPost) =>
      Boolean(
        post.party?.members.some(
          (member) =>
            member.id === authorId &&
            (member.isHost || member.status === "accepted" || member.status == null)
        )
      ),
    [authorId]
  );

  const isPartyPending = useCallback(
    (post: CommunityPost) =>
      Boolean(post.party?.pendingMembers?.some((member) => member.id === authorId)),
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
      // 승인제는 로그인(Supabase) 경로만 — 게스트는 UI에서 로그인 유도
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
          if (post.party.pendingMembers?.some((member) => member.id === authorId)) {
            return post;
          }
          if (post.party.current >= post.party.needed) return post;

          requested = true;
          const pendingMembers = [
            ...(post.party.pendingMembers ?? []),
            {
              id: authorId,
              name: profile.name,
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
              profile.name,
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
    [authorId, profile.name, useDb, userId]
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
              pendingMembers: pending.filter((member) => member.id !== authorId),
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
    [authorId, useDb, userId]
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
    [authorId, useDb, userId]
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
    [authorId, useDb, userId]
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
    [authorId, useDb, userId]
  );

  const stateValue = useMemo(
    () => ({
      posts,
      isReady,
    }),
    [posts, isReady]
  );

  const actionValue = useMemo(
    () => ({
      getPost,
      addPost,
      updatePost,
      removePost,
      canEdit,
      canDelete,
      toggleLike,
      isLiked,
      addComment,
      updateComment,
      removeComment,
      canManageComment,
      joinParty,
      leaveParty,
      cancelJoinRequest,
      acceptJoin,
      rejectJoin,
      isPartyJoined,
      isPartyPending,
      isPartyHost,
      isPartyFull,
    }),
    [
      getPost,
      addPost,
      updatePost,
      removePost,
      canEdit,
      canDelete,
      toggleLike,
      isLiked,
      addComment,
      updateComment,
      removeComment,
      canManageComment,
      joinParty,
      leaveParty,
      cancelJoinRequest,
      acceptJoin,
      rejectJoin,
      isPartyJoined,
      isPartyPending,
      isPartyHost,
      isPartyFull,
    ]
  );

  return (
    <CommunityStateContext.Provider value={stateValue}>
      <CommunityActionContext.Provider value={actionValue}>
        {children}
      </CommunityActionContext.Provider>
    </CommunityStateContext.Provider>
  );
}

export function useCommunity() {
  const state = useContext(CommunityStateContext);
  const actions = useContext(CommunityActionContext);
  if (!state || !actions) {
    throw new Error("useCommunity must be used within CommunityProvider");
  }
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}

export function useCommunityState() {
  const context = useContext(CommunityStateContext);
  if (!context) {
    throw new Error("useCommunityState must be used within CommunityProvider");
  }
  return context;
}

export function useCommunityActions() {
  const context = useContext(CommunityActionContext);
  if (!context) {
    throw new Error("useCommunityActions must be used within CommunityProvider");
  }
  return context;
}
