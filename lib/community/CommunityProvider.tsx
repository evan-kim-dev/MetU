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
import type {
  CommunityPost,
  CreatePostInput,
  PostComment,
  UpdatePostInput,
} from "@/lib/community/types";
import { syncPostCounts } from "@/lib/community/counts";

interface CommunityContextValue {
  posts: CommunityPost[];
  isReady: boolean;
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
  isPartyJoined: (post: CommunityPost) => boolean;
  isPartyHost: (post: CommunityPost) => boolean;
  isPartyFull: (post: CommunityPost) => boolean;
}

const CommunityContext = createContext<CommunityContextValue | null>(null);

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const { user, provider } = useAuth();
  const { profile } = useProfile();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setPosts(loadCommunityPosts());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    saveCommunityPosts(posts.map(syncPostCounts));
  }, [posts, isReady]);

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

      const post: CommunityPost = {
        id: `post-${crypto.randomUUID()}`,
        category: input.category,
        authorId,
        author: profile.name,
        avatar: avatarEmoji,
        destination: input.destination.trim(),
        title: input.title.trim(),
        preview: input.body.trim(),
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

      setPosts((prev) => [post, ...prev]);
      return post;
    },
    [authorId, profile.name]
  );

  const removePost = useCallback(
    (id: string) => {
      const target = posts.find((post) => post.id === id);
      if (!target || target.authorId !== authorId) return false;
      setPosts((prev) => prev.filter((post) => post.id !== id));
      return true;
    },
    [authorId, posts]
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
            party: nextParty,
          });
        })
      );
      return true;
    },
    [authorId, posts, profile.name]
  );

  const isLiked = useCallback(
    (post: CommunityPost) => post.likedBy.includes(authorId),
    [authorId]
  );

  const toggleLike = useCallback(
    (postId: string) => {
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const liked = post.likedBy.includes(authorId);
          if (liked) {
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
    },
    [authorId]
  );

  const addComment = useCallback(
    (postId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return false;

      const now = new Date().toISOString();
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const comment = {
            id: `comment-${crypto.randomUUID()}`,
            authorId,
            author: profile.name,
            avatar: "💬",
            content: trimmed,
            createdAt: formatRelativeTime(now),
            createdAtIso: now,
          };
          const commentList = [...post.commentList, comment];
          return syncPostCounts({
            ...post,
            commentList,
          });
        })
      );
      return true;
    },
    [authorId, profile.name]
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
      return updated;
    },
    [authorId]
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
      return removed;
    },
    [authorId]
  );

  const isPartyJoined = useCallback(
    (post: CommunityPost) =>
      Boolean(
        post.party?.members.some((member) => member.id === authorId)
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
      let joined = false;
      const now = new Date().toISOString();

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId || !post.party) return post;
          if (post.party.members.some((member) => member.id === authorId)) {
            return post;
          }
          if (post.party.current >= post.party.needed) return post;

          joined = true;
          const members = [
            ...post.party.members,
            {
              id: authorId,
              name: profile.name,
              avatar: "🧑",
              joinedAtIso: now,
            },
          ];
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
      return joined;
    },
    [authorId, profile.name]
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
      return left;
    },
    [authorId]
  );

  const value = useMemo(
    () => ({
      posts,
      isReady,
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
      isPartyJoined,
      isPartyHost,
      isPartyFull,
    }),
    [
      posts,
      isReady,
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
      isPartyJoined,
      isPartyHost,
      isPartyFull,
    ]
  );

  return (
    <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>
  );
}

export function useCommunity() {
  const context = useContext(CommunityContext);
  if (!context) {
    throw new Error("useCommunity must be used within CommunityProvider");
  }
  return context;
}
