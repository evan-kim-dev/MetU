"use client";

import { useMemo, useState } from "react";
import {
  useCommunityActions,
  useCommunityState,
} from "@/lib/community/CommunityProvider";
import { useChatRoomSummaries } from "@/lib/community/useChatRoomSummaries";
import {
  CATEGORY_LABELS,
  type PostCategory,
  type WritablePostCategory,
} from "@/lib/mock/community";
import type { CommunityPost } from "@/lib/community/types";

export type PostSort = "latest" | "likes" | "comments";

export const SORT_LABELS: Record<PostSort, string> = {
  latest: "최신순",
  likes: "좋아요순",
  comments: "댓글순",
};

function postMatchesSearch(post: CommunityPost, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    post.title,
    post.preview,
    post.destination,
    post.author,
    CATEGORY_LABELS[post.category],
    post.party?.budgetPerPerson ?? "",
    ...post.commentList.map((comment) => comment.content),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function formatChatClock(iso?: string): string {
  if (!iso) return "--:--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

interface UseCommunityListStateArgs {
  defaultCategory: PostCategory;
  defaultWriteCategory: WritablePostCategory;
  showChatRooms: boolean;
}

export function useCommunityListState({
  defaultCategory,
  defaultWriteCategory,
  showChatRooms,
}: UseCommunityListStateArgs) {
  const { posts, isReady } = useCommunityState();
  const {
    addPost,
    isPartyHost,
    isPartyJoined,
    leaveParty,
    removePost,
    canEdit,
  } = useCommunityActions();

  const [activeCategory, setActiveCategory] =
    useState<PostCategory>(defaultCategory);
  const [sortBy, setSortBy] = useState<PostSort>("latest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [writeOpen, setWriteOpen] = useState(false);
  const [writeCategory, setWriteCategory] = useState<WritablePostCategory>(
    defaultWriteCategory
  );
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [chatManageMode, setChatManageMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [postManageMode, setPostManageMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);

  const filteredPosts = useMemo(() => {
    const filtered =
      activeCategory === "all"
        ? posts
        : posts.filter((post) => post.category === activeCategory);

    const searched = searchQuery.trim()
      ? filtered.filter((post) => postMatchesSearch(post, searchQuery))
      : filtered;

    const sorted = [...searched];
    sorted.sort((a, b) => {
      if (sortBy === "likes") {
        return (
          b.likes - a.likes ||
          new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()
        );
      }
      if (sortBy === "comments") {
        return (
          b.comments - a.comments ||
          new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()
        );
      }
      return new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime();
    });

    return sorted;
  }, [activeCategory, posts, searchQuery, sortBy]);

  const chatRoomPosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          post.category === "party" &&
          (isPartyHost(post) || isPartyJoined(post))
      ),
    [isPartyHost, isPartyJoined, posts]
  );

  const { lastMessageByPostId, lastTimeByPostId, unreadCountByPostId } =
    useChatRoomSummaries(
      chatRoomPosts.map((post) => post.id),
      showChatRooms
    );

  function resolveWriteCategory(): WritablePostCategory {
    return activeCategory === "all" ? defaultWriteCategory : activeCategory;
  }

  function openWrite(category: WritablePostCategory = defaultWriteCategory) {
    setWriteCategory(category);
    setWriteOpen(true);
  }

  function openChatManage() {
    setChatMenuOpen(false);
    setSelectedChatIds([]);
    setChatManageMode(true);
  }

  function exitChatManage() {
    setChatManageMode(false);
    setSelectedChatIds([]);
  }

  function toggleChatSelection(postId: string) {
    setSelectedChatIds((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  }

  function handleLeaveSelected() {
    if (selectedChatIds.length === 0) return;

    const selectedPosts = chatRoomPosts.filter((post) =>
      selectedChatIds.includes(post.id)
    );
    const hostCount = selectedPosts.filter((post) => isPartyHost(post)).length;
    const memberCount = selectedPosts.length - hostCount;

    let confirmMessage = `선택한 채팅방 ${selectedPosts.length}개에서 나갈까요?`;
    if (hostCount > 0 && memberCount > 0) {
      confirmMessage =
        "방장 채팅방은 모집 글과 함께 삭제되고, 참여 중인 채팅방에서는 나갑니다. 계속할까요?";
    } else if (hostCount > 0) {
      confirmMessage = `선택한 채팅방 ${hostCount}개를 삭제할까요? 모집 글도 함께 삭제돼요.`;
    }

    if (!window.confirm(confirmMessage)) return;

    selectedPosts.forEach((post) => {
      if (isPartyHost(post)) {
        removePost(post.id);
      } else {
        leaveParty(post.id);
      }
    });
    exitChatManage();
  }

  function openPostManage() {
    setPostManageMode(true);
    setSelectedPostIds([]);
    setSearchOpen(false);
    setSortMenuOpen(false);
  }

  function exitPostManage() {
    setPostManageMode(false);
    setSelectedPostIds([]);
  }

  function togglePostSelection(post: CommunityPost) {
    if (!canEdit(post)) return;
    setSelectedPostIds((prev) =>
      prev.includes(post.id) ? prev.filter((id) => id !== post.id) : [...prev, post.id]
    );
  }

  function handleDeleteSelectedPosts() {
    if (selectedPostIds.length === 0) return;

    const selectedPosts = filteredPosts.filter(
      (post) => selectedPostIds.includes(post.id) && canEdit(post)
    );
    if (selectedPosts.length === 0) return;

    if (
      !window.confirm(
        `선택한 게시글 ${selectedPosts.length}개를 삭제할까요? 삭제 후 되돌릴 수 없어요.`
      )
    ) {
      return;
    }

    selectedPosts.forEach((post) => {
      removePost(post.id);
    });
    exitPostManage();
  }

  return {
    isReady,
    addPost,
    canEdit,
    isPartyHost,
    activeCategory,
    setActiveCategory,
    sortBy,
    setSortBy,
    sortMenuOpen,
    setSortMenuOpen,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    writeOpen,
    setWriteOpen,
    writeCategory,
    chatMenuOpen,
    setChatMenuOpen,
    chatManageMode,
    selectedChatIds,
    postManageMode,
    selectedPostIds,
    filteredPosts,
    chatRoomPosts,
    lastMessageByPostId,
    lastTimeByPostId,
    unreadCountByPostId,
    resolveWriteCategory,
    openWrite,
    openChatManage,
    exitChatManage,
    toggleChatSelection,
    handleLeaveSelected,
    openPostManage,
    exitPostManage,
    togglePostSelection,
    handleDeleteSelectedPosts,
  };
}
