"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowUpDown, PenLine, Search, Settings, X } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { CommunityGatedLayout } from "@/components/auth/AuthGateOverlay";
import { PostCard } from "@/components/community/PostCard";
import { WritePostSheet } from "@/components/community/WritePostSheet";
import { useAuth } from "@/lib/auth/AuthProvider";
import { requiresCommunityLogin } from "@/lib/auth/community-access";
import { markChatSeen } from "@/lib/community/chat-notice";
import { useCommunity } from "@/lib/community/CommunityProvider";
import { useChatRoomSummaries } from "@/lib/community/useChatRoomSummaries";
import {
  CATEGORY_LABELS,
  type PostCategory,
  type WritablePostCategory,
} from "@/lib/mock/community";
import type { CommunityPost } from "@/lib/community/types";

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

type PostSort = "latest" | "likes" | "comments";

const SORT_LABELS: Record<PostSort, string> = {
  latest: "최신순",
  likes: "좋아요순",
  comments: "댓글순",
};

interface CommunityListPageProps {
  title?: string;
  heading?: string;
  description?: string;
  featureName: string;
  basePath: "/opod" | "/board";
  categories: PostCategory[];
  defaultCategory: PostCategory;
  defaultWriteCategory: WritablePostCategory;
  showChatRooms?: boolean;
  showPostList?: boolean;
}

export function CommunityListPage({
  title,
  heading,
  description = "",
  featureName,
  basePath,
  categories,
  defaultCategory,
  defaultWriteCategory,
  showChatRooms = false,
  showPostList = true,
}: CommunityListPageProps) {
  const router = useRouter();
  const { user, provider, isReady: isAuthReady } = useAuth();
  const gated =
    isAuthReady && requiresCommunityLogin(user, provider);
  const { posts, isReady, addPost, isPartyHost, isPartyJoined, leaveParty, removePost } =
    useCommunity();
  const [activeCategory, setActiveCategory] = useState<PostCategory>(defaultCategory);
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

  const { lastMessageByPostId, lastTimeByPostId, unreadCountByPostId } = useChatRoomSummaries(
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

  function formatChatClock(iso?: string): string {
    if (!iso) return "--:--";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "--:--";
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${hour}:${minute}`;
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

  const listBody = (
    <div className="flex flex-col gap-5 px-5 pb-20 pt-5">
        {heading ? (
          <h1 className="text-[22px] font-bold tracking-tight text-ink-heading">
            {heading}
          </h1>
        ) : description.trim() ? (
          <p className="text-sm leading-relaxed text-ink-caption">{description}</p>
        ) : null}

        {showChatRooms ? (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[22px] font-extrabold leading-7 tracking-tight text-ink-heading">
                {chatManageMode ? "채팅방 관리" : "내 채팅방"}
              </h2>
              {chatManageMode ? (
                <button
                  type="button"
                  onClick={exitChatManage}
                  className="rounded-full px-2 py-1 text-xs font-semibold text-ink-caption transition-colors hover:bg-surface-soft"
                >
                  취소
                </button>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    aria-label="채팅방 설정"
                    onClick={() => setChatMenuOpen((prev) => !prev)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-caption transition-colors hover:bg-surface-soft"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  {chatMenuOpen ? (
                    <div className="absolute right-0 top-8 z-10 min-w-[132px] rounded-lg border border-line-soft bg-surface-white p-1 shadow-soft">
                      <button
                        type="button"
                        onClick={openChatManage}
                        className="w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-ink-heading hover:bg-surface-soft"
                      >
                        채팅방 관리
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {!isReady ? (
              <p className="mt-2 text-xs text-ink-caption">채팅방 불러오는 중...</p>
            ) : chatRoomPosts.length === 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-ink-caption">
                동행에 참여하거나 내가 모집한 글에서 채팅방이 생성돼요.
              </p>
            ) : (
              <>
                <div className="mt-2 overflow-hidden rounded-xl2 border border-line-soft bg-surface-white shadow-soft">
                  {chatRoomPosts.map((post) => {
                    const host = isPartyHost(post);
                    const selected = selectedChatIds.includes(post.id);

                    return (
                      <button
                        key={`chat-${post.id}`}
                        type="button"
                        onClick={() => {
                          if (chatManageMode) {
                            toggleChatSelection(post.id);
                            return;
                          }
                          markChatSeen(post.id);
                          router.push(`${basePath}/${post.id}/chat`);
                        }}
                        className="flex w-full items-center justify-between gap-3 border-b border-line-soft px-3 py-3 text-left last:border-b-0 active:bg-surface-soft"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          {chatManageMode ? (
                            <span
                              aria-hidden
                              className={[
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                selected
                                  ? "border-brand bg-brand"
                                  : "border-line-soft bg-surface-white",
                              ].join(" ")}
                            >
                              {selected ? (
                                <Check className="h-3 w-3 stroke-[3] text-surface-white" />
                              ) : null}
                            </span>
                          ) : null}
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEE500] text-sm font-extrabold text-ink-heading">
                            {post.title.slice(0, 1)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-ink-heading">
                              {post.title}
                            </p>
                            <p className="truncate text-xs text-ink-caption">
                              {lastMessageByPostId[post.id] ?? "아직 채팅이 없어요"}
                            </p>
                          </div>
                        </div>
                        {chatManageMode ? (
                          host ? (
                            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                              방장
                            </span>
                          ) : null
                        ) : (
                          <div className="ml-3 flex shrink-0 flex-col items-end">
                            <span className="text-[11px] font-semibold text-ink-caption">
                              {formatChatClock(lastTimeByPostId[post.id])}
                            </span>
                            {(unreadCountByPostId[post.id] ?? 0) > 0 ? (
                              <span className="mt-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#FAE100] px-1.5 py-0.5 text-[10px] font-bold text-ink-heading">
                                {unreadCountByPostId[post.id]}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {chatManageMode ? (
                  <button
                    type="button"
                    disabled={selectedChatIds.length === 0}
                    onClick={handleLeaveSelected}
                    className="mt-3 w-full rounded-xl border border-danger/20 bg-danger/5 py-3 text-sm font-bold text-danger disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {selectedChatIds.length > 0
                      ? `선택한 ${selectedChatIds.length}개 채팅방 나가기`
                      : "채팅방을 선택해 주세요"}
                  </button>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {showPostList ? (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar">
                  {categories.length > 1
                    ? categories.map((category) => {
                        const active = activeCategory === category;
                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => setActiveCategory(category)}
                            className={[
                              "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors",
                              active
                                ? category === "party"
                                  ? "ai-gradient-bg text-surface-white shadow-glow"
                                  : "bg-brand text-surface-white shadow-soft"
                                : "border border-line-soft bg-surface-white text-ink-caption",
                            ].join(" ")}
                          >
                            {CATEGORY_LABELS[category]}
                          </button>
                        );
                      })
                    : null}
                </div>

                <button
                  type="button"
                  aria-label="게시글 검색"
                  aria-pressed={searchOpen}
                  onClick={() => {
                    setSearchOpen((prev) => {
                      if (prev) setSearchQuery("");
                      return !prev;
                    });
                    setSortMenuOpen(false);
                  }}
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                    searchOpen || searchQuery.trim()
                      ? "border-brand/30 bg-brand/10 text-brand"
                      : "border-line-soft bg-surface-white text-ink-caption hover:bg-surface-soft",
                  ].join(" ")}
                >
                  <Search className="h-4 w-4" strokeWidth={2.2} />
                </button>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label={`정렬: ${SORT_LABELS[sortBy]}`}
                    onClick={() => {
                      setSortMenuOpen((prev) => !prev);
                      setSearchOpen(false);
                    }}
                    className={[
                      "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                      sortBy === "latest"
                        ? "border-line-soft bg-surface-white text-ink-caption hover:bg-surface-soft"
                        : "border-brand/30 bg-brand/10 text-brand",
                    ].join(" ")}
                  >
                    <ArrowUpDown className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                  {sortMenuOpen ? (
                    <div className="absolute right-0 top-10 z-10 min-w-[132px] rounded-lg border border-line-soft bg-surface-white p-1 shadow-soft">
                      {(Object.keys(SORT_LABELS) as PostSort[]).map((option) => {
                        const selected = sortBy === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setSortBy(option);
                              setSortMenuOpen(false);
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-ink-heading hover:bg-surface-soft"
                          >
                            <span>{SORT_LABELS[option]}</span>
                            {selected ? (
                              <Check className="h-3.5 w-3.5 text-brand" strokeWidth={2.4} />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              {searchOpen ? (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-caption" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="제목, 내용, 여행지, 작성자 검색"
                    className="h-11 w-full rounded-xl border border-line-soft bg-surface-white pl-10 pr-10 text-sm text-ink-heading outline-none transition-colors placeholder:text-ink-caption focus:border-brand"
                    autoFocus
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      aria-label="검색어 지우기"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-caption transition-colors hover:bg-surface-soft"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              {!isReady ? (
                <p className="py-10 text-center text-sm text-ink-caption">불러오는 중...</p>
              ) : filteredPosts.length === 0 && searchQuery.trim() ? (
                <div className="rounded-xl2 border border-dashed border-line-soft px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-ink-heading">
                    &apos;{searchQuery.trim()}&apos; 검색 결과가 없어요
                  </p>
                  <p className="mt-1 text-xs text-ink-caption">
                    다른 키워드로 다시 검색해 보세요.
                  </p>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="rounded-xl2 border border-dashed border-line-soft px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-ink-heading">
                    아직 게시글이 없어요
                  </p>
                  <button
                    type="button"
                    onClick={() => openWrite(resolveWriteCategory())}
                    className="mt-3 text-sm font-bold text-brand"
                  >
                    첫 글 작성하기
                  </button>
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} basePath={basePath} />
                ))
              )}
            </div>
          </>
        ) : null}
    </div>
  );

  return (
    <MobileShell title={title}>
      {gated ? (
        <CommunityGatedLayout featureName={featureName}>
          {listBody}
        </CommunityGatedLayout>
      ) : (
        listBody
      )}

      {showPostList && !gated ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-30 flex justify-center">
          <div className="pointer-events-none w-full max-w-mobile px-5">
            <div className="pointer-events-none flex justify-end">
              <button
                type="button"
                aria-label="글쓰기"
                onClick={() => openWrite(resolveWriteCategory())}
                className="pointer-events-auto flex h-12 min-w-[48px] items-center justify-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-surface-white shadow-soft transition-all active:scale-95 active:brightness-95"
              >
                <PenLine className="h-5 w-5" strokeWidth={2.4} />
                <span>글쓰기</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!gated ? (
        <WritePostSheet
          open={writeOpen}
          initialCategory={writeCategory}
          onClose={() => setWriteOpen(false)}
          onSubmit={(input) => {
            const created = addPost(input);
            setWriteOpen(false);
            router.push(`${basePath}/${created.id}`);
          }}
        />
      ) : null}
    </MobileShell>
  );
}
