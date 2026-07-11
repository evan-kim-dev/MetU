"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  formatRelativeTime,
} from "@/lib/community/storage";
import {
  deleteCommunityPostFromSupabase,
  deletePostCommentFromSupabase,
  fetchCommunityPostsFromSupabase,
  insertCommunityPostToSupabase,
  insertPostCommentToSupabase,
  togglePostLikeInSupabase,
  toggleCommentLikeInSupabase,
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
import { useCommunityFeed } from "@/lib/community/useCommunityFeed";
import { useCommunityPartyActions } from "@/lib/community/useCommunityPartyActions";
import {
  collectAuthorIdsFromPosts,
  enrichPostsWithAuthorProfiles,
  fetchAuthorProfilesByIds,
} from "@/lib/profile/enrich-author-avatars";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface CommunityStateContextValue {
  posts: CommunityPost[];
  isReady: boolean;
}

interface CommunityActionContextValue {
  getPost: (id: string) => CommunityPost | undefined;
  addPost: (input: CreatePostInput) => Promise<CommunityPost>;
  updatePost: (id: string, input: UpdatePostInput) => boolean;
  removePost: (id: string) => boolean;
  canEdit: (post: CommunityPost) => boolean;
  canDelete: (post: CommunityPost) => boolean;
  toggleLike: (postId: string) => void;
  isLiked: (post: CommunityPost) => boolean;
  toggleCommentLike: (postId: string, commentId: string) => void;
  isCommentLiked: (comment: PostComment) => boolean;
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

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const {
    posts,
    setPosts,
    isReady,
    useDb,
    userId,
    authorId,
    profile,
  } = useCommunityFeed();

  const postsRef = useRef(posts);
  postsRef.current = posts;

  const authorIdsKey = useMemo(
    () => collectAuthorIdsFromPosts(posts).sort().join(","),
    [posts]
  );

  useEffect(() => {
    if (!isReady || !authorIdsKey) return;

    let cancelled = false;
    const ids = authorIdsKey.split(",").filter(Boolean);

    void fetchAuthorProfilesByIds(ids).then((profiles) => {
      if (cancelled || Object.keys(profiles).length === 0) return;
      setPosts((prev) => enrichPostsWithAuthorProfiles(prev, profiles));
    });

    return () => {
      cancelled = true;
    };
  }, [authorIdsKey, isReady, setPosts]);

  const getPost = useCallback(
    (id: string) => postsRef.current.find((post) => post.id === id),
    []
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
    async (input: CreatePostInput): Promise<CommunityPost> => {
      const now = new Date().toISOString();
      const authorAvatar =
        profile.customAvatarUrl ||
        profile.avatarUrl ||
        (input.category === "party"
          ? "🎮"
          : input.category === "review"
            ? "🌏"
            : input.category === "tip"
              ? "💡"
              : input.category === "chat"
                ? "💬"
                : "✈️");

      const optimistic: CommunityPost = {
        id: `post-${crypto.randomUUID()}`,
        category: input.category,
        authorId,
        author: profile.name,
        avatar: authorAvatar,
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
                  avatar: authorAvatar,
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
          const saved = await insertCommunityPostToSupabase(
            supabase,
            authorId,
            profile.name,
            authorAvatar,
            input
          );
          if (saved) {
            setPosts((prev) =>
              prev.map((post) => (post.id === optimistic.id ? saved : post))
            );
            return saved;
          }
        }
      }

      return optimistic;
    },
    [authorId, profile.avatarUrl, profile.customAvatarUrl, profile.name, setPosts, useDb, userId]
  );

  const removePost = useCallback(
    (id: string) => {
      const target = postsRef.current.find((post) => post.id === id);
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
    [authorId, setPosts, useDb, userId]
  );

  const updatePost = useCallback(
    (id: string, input: UpdatePostInput) => {
      const target = postsRef.current.find((post) => post.id === id);
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
    [authorId, profile.name, setPosts, useDb, userId]
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
    [authorId, setPosts, useDb, userId]
  );

  const isCommentLiked = useCallback(
    (comment: PostComment) => (comment.likedBy ?? []).includes(authorId),
    [authorId]
  );

  const toggleCommentLike = useCallback(
    (postId: string, commentId: string) => {
      let wasLiked = false;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          return {
            ...post,
            commentList: post.commentList.map((comment) => {
              if (comment.id !== commentId) return comment;
              const likedBy = comment.likedBy ?? [];
              wasLiked = likedBy.includes(authorId);
              if (wasLiked) {
                const nextLikedBy = likedBy.filter((id) => id !== authorId);
                return {
                  ...comment,
                  likedBy: nextLikedBy,
                  likes: Math.max(0, (comment.likes ?? likedBy.length) - 1),
                };
              }
              return {
                ...comment,
                likedBy: [...likedBy, authorId],
                likes: (comment.likes ?? likedBy.length) + 1,
              };
            }),
          };
        })
      );

      if (useDb && userId) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          void toggleCommentLikeInSupabase(
            supabase,
            commentId,
            authorId,
            wasLiked
          );
        }
      }
    },
    [authorId, setPosts, useDb, userId]
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
            avatar: profile.customAvatarUrl || profile.avatarUrl || "💬",
            content: trimmed,
            createdAt: formatRelativeTime(now),
            createdAtIso: now,
            likes: 0,
            likedBy: [],
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
            const commentAvatar =
              profile.customAvatarUrl || profile.avatarUrl || "💬";
            const saved = await insertPostCommentToSupabase(
              supabase,
              postId,
              authorId,
              profile.name,
              trimmed,
              commentAvatar
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
    [authorId, profile.name, setPosts, useDb, userId]
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
    [authorId, setPosts, useDb, userId]
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
    [authorId, setPosts, useDb, userId]
  );

  const {
    joinParty,
    leaveParty,
    cancelJoinRequest,
    acceptJoin,
    rejectJoin,
    isPartyJoined,
    isPartyPending,
    isPartyHost,
    isPartyFull,
  } = useCommunityPartyActions({
    setPosts,
    useDb,
    userId,
    authorId,
    profileName: profile.name,
  });

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
      toggleCommentLike,
      isCommentLiked,
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
      toggleCommentLike,
      isCommentLiked,
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

export function useCommunityState() {
  const state = useContext(CommunityStateContext);
  if (!state) {
    throw new Error("useCommunityState must be used within CommunityProvider");
  }
  return state;
}

export function useCommunityActions() {
  const actions = useContext(CommunityActionContext);
  if (!actions) {
    throw new Error("useCommunityActions must be used within CommunityProvider");
  }
  return actions;
}

export function useCommunity() {
  const state = useCommunityState();
  const actions = useCommunityActions();
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}
