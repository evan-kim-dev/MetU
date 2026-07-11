"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { requiresCommunityLogin } from "@/lib/auth/community-access";
import {
  useCommunityActions,
  useCommunityState,
} from "@/lib/community/CommunityProvider";
import { getCommentCount, getLikeCount } from "@/lib/community/counts";

export function usePostDetailActions(
  postId: string,
  listHref: "/opod" | "/board" = "/board"
) {
  const router = useRouter();
  const { user, provider } = useAuth();
  const { posts, isReady } = useCommunityState();
  const {
    updatePost,
    removePost,
    canEdit,
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
  } = useCommunityActions();

  const post = useMemo(
    () => posts.find((item) => item.id === postId),
    [postId, posts]
  );
  const [commentDraft, setCommentDraft] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentEditDraft, setCommentEditDraft] = useState("");

  const derived = useMemo(() => {
    if (!post) return null;
    const isParty = post.category === "party" && Boolean(post.party);
    return {
      editable: canEdit(post),
      isParty,
      liked: isLiked(post),
      joined: isParty ? isPartyJoined(post) : false,
      pending: isParty ? isPartyPending(post) : false,
      isHost: isParty ? isPartyHost(post) : false,
      isFull: isParty ? isPartyFull(post) : false,
      slotsLeft: isParty && post.party ? post.party.needed - post.party.current : 0,
      likeCount: getLikeCount(post),
      commentCount: getCommentCount(post),
      pendingMembers: post.party?.pendingMembers ?? [],
      needsLogin: requiresCommunityLogin(user, provider),
    };
  }, [
    canEdit,
    isLiked,
    isPartyFull,
    isPartyHost,
    isPartyJoined,
    isPartyPending,
    post,
    provider,
    user,
  ]);

  function handleJoinRequest() {
    if (!post) return;
    if (derived?.needsLogin) {
      router.push(`/login?next=${encodeURIComponent(`${listHref}/${post.id}`)}`);
      return;
    }
    joinParty(post.id);
  }

  function handleDelete() {
    if (!derived?.editable || !post) return;
    const ok = window.confirm("이 게시글을 삭제할까요?");
    if (!ok) return;
    removePost(post.id);
    router.replace(listHref);
  }

  function handleSubmitComment() {
    if (!commentDraft.trim() || !post) return;
    addComment(post.id, commentDraft);
    setCommentDraft("");
  }

  function handleDeleteComment(commentId: string) {
    if (!post) return;
    const ok = window.confirm("이 댓글을 삭제할까요?");
    if (!ok) return;
    removeComment(post.id, commentId);
    if (editingCommentId === commentId) {
      setEditingCommentId(null);
      setCommentEditDraft("");
    }
  }

  function handleStartEditComment(commentId: string, content: string) {
    setEditingCommentId(commentId);
    setCommentEditDraft(content);
  }

  function handleSaveComment(commentId: string) {
    if (!commentEditDraft.trim() || !post) return;
    const ok = updateComment(post.id, commentId, commentEditDraft);
    if (!ok) return;
    setEditingCommentId(null);
    setCommentEditDraft("");
  }

  return {
    router,
    post,
    isReady,
    listHref,
    commentDraft,
    setCommentDraft,
    editOpen,
    setEditOpen,
    editingCommentId,
    setEditingCommentId,
    commentEditDraft,
    setCommentEditDraft,
    updatePost,
    toggleLike,
    toggleCommentLike,
    isCommentLiked,
    leaveParty,
    cancelJoinRequest,
    acceptJoin,
    rejectJoin,
    canManageComment,
    ...derived,
    handleJoinRequest,
    handleDelete,
    handleSubmitComment,
    handleDeleteComment,
    handleStartEditComment,
    handleSaveComment,
  };
}

export function formatPartyDateRange(start: string, end: string): string {
  return `${start.replaceAll("-", ".")} ~ ${end.replaceAll("-", ".")}`;
}
