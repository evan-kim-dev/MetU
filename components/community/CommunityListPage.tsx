"use client";

import { useRouter } from "next/navigation";
import { Check, ArrowUpDown, PenLine, Search, Settings, X } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { CommunityGatedLayout } from "@/components/auth/AuthGateOverlay";
import { PostCard } from "@/components/community/PostCard";
import { WritePostSheet } from "@/components/community/WritePostSheet";
import {
  SORT_LABELS,
  formatChatClock,
  useCommunityListState,
  type PostSort,
} from "@/components/community/useCommunityListState";
import { HorizontalScroller } from "@/components/ui/HorizontalScroller";
import { useAuth } from "@/lib/auth/AuthProvider";
import { requiresCommunityLogin } from "@/lib/auth/community-access";
import { markChatSeen } from "@/lib/community/chat-notice";
import { useFriends } from "@/lib/friends/FriendsProvider";
import { isAvatarImage } from "@/lib/profile/public";
import {
  CATEGORY_LABELS,
  type PostCategory,
  type WritablePostCategory,
} from "@/lib/mock/community";
import { AuthorAvatarLink } from "@/components/community/AuthorAvatarLink";

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
  const { friends, isReady: friendsReady } = useFriends();
  const gated =
    isAuthReady && requiresCommunityLogin(user, provider);
  const {
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
  } = useCommunityListState({
    defaultCategory,
    defaultWriteCategory,
    showChatRooms,
  });

  const listBody = (
    <div className="flex flex-col gap-5 px-5 pb-20 pt-5">
        {heading ? (
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-heading font-bold tracking-tight text-ink-heading">
              {postManageMode ? "게시글 관리" : heading}
            </h1>
            {showPostList && !gated ? (
              postManageMode ? (
                <button
                  type="button"
                  onClick={exitPostManage}
                  className="rounded-full px-2 py-1 text-xs font-semibold text-ink-caption transition-colors hover:bg-surface-soft"
                >
                  취소
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="게시글 관리"
                  onClick={openPostManage}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-surface-white text-ink-caption shadow-sm transition-all duration-300 hover:bg-surface-soft hover:text-ink-heading"
                >
                  <PenLine className="h-4 w-4" strokeWidth={2.2} />
                </button>
              )
            ) : null}
          </div>
        ) : description.trim() ? (
          <p className="text-sm leading-relaxed text-ink-caption">{description}</p>
        ) : null}

        {showChatRooms ? (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-heading font-extrabold leading-7 tracking-tight text-ink-heading">
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
                    <div className="absolute right-0 top-8 z-10 min-w-menu rounded-2xl border-0 bg-surface-white p-1 shadow-md">
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
                <div className="mt-2 overflow-hidden rounded-2xl border-0 bg-surface-white shadow-sm">
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
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kakao text-sm font-extrabold text-ink-heading">
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
                            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-2xs font-bold text-brand">
                              방장
                            </span>
                          ) : null
                        ) : (
                          <div className="ml-3 flex shrink-0 flex-col items-end">
                            <span className="text-xs font-semibold text-ink-caption">
                              {formatChatClock(lastTimeByPostId[post.id])}
                            </span>
                            {(unreadCountByPostId[post.id] ?? 0) > 0 ? (
                              <span className="mt-1 inline-flex min-w-5 items-center justify-center rounded-full bg-kakao-strong px-1.5 py-0.5 text-2xs font-bold text-ink-heading">
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

        {showChatRooms ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-heading font-extrabold leading-7 tracking-tight text-ink-heading">
              친구
            </h2>
            {!friendsReady ? (
              <p className="mt-2 text-xs text-ink-caption">친구 불러오는 중...</p>
            ) : friends.length === 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-ink-caption">
                게시글에서 친구를 추가하고, 상대가 수락하면 여기에 보여요.
              </p>
            ) : (
              <div className="mt-1 overflow-hidden rounded-2xl border-0 bg-surface-white shadow-sm">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-3 last:border-b-0"
                  >
                    <AuthorAvatarLink
                      userId={friend.id}
                      name={friend.name}
                      avatar={
                        isAvatarImage(friend.avatar) ? friend.avatar : friend.avatar
                      }
                      size="sm"
                      showName
                      className="min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => router.push(`/opod/dm/${friend.id}`)}
                      className="shrink-0 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand active:bg-brand/15"
                    >
                      채팅
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {showPostList ? (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <HorizontalScroller aria-label="게시판 카테고리">
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
                                  ? "bg-brand text-surface-white shadow-md"
                                  : "bg-brand text-surface-white shadow-md"
                                : "border-0 bg-surface-white text-ink-caption shadow-sm",
                            ].join(" ")}
                          >
                            {CATEGORY_LABELS[category]}
                          </button>
                        );
                      })
                    : null}
                </HorizontalScroller>

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
                    <div className="absolute right-0 top-10 z-10 min-w-menu rounded-2xl border-0 bg-surface-white p-1 shadow-md">
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
                    className="h-11 w-full rounded-2xl border-0 bg-surface-white shadow-sm pl-10 pr-10 text-sm text-ink-heading outline-none transition-colors placeholder:text-ink-caption focus:border-brand"
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
                <div className="flex flex-col gap-3" aria-busy="true" aria-label="불러오는 중">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-28 animate-pulse rounded-xl2 bg-surface-soft"
                    />
                  ))}
                </div>
              ) : filteredPosts.length === 0 && searchQuery.trim() ? (
                <div className="rounded-2xl border-0 bg-surface-soft shadow-sm px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-ink-heading">
                    &apos;{searchQuery.trim()}&apos; 검색 결과가 없어요
                  </p>
                  <p className="mt-1 text-xs text-ink-caption">
                    다른 키워드로 다시 검색해 보세요.
                  </p>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="rounded-2xl border-0 bg-surface-soft shadow-sm px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-ink-heading">
                    아직 게시글이 없어요
                  </p>
                  <p className="mt-1 text-xs text-ink-caption">
                    얼리 액세스 첫 글을 남겨보세요.
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
                filteredPosts.map((post) => {
                  const editable = canEdit(post);
                  const selected = selectedPostIds.includes(post.id);

                  if (!postManageMode) {
                    return (
                      <PostCard key={post.id} post={post} basePath={basePath} />
                    );
                  }

                  return (
                    <button
                      key={post.id}
                      type="button"
                      disabled={!editable}
                      onClick={() => togglePostSelection(post)}
                      className={[
                        "flex w-full items-start gap-3 rounded-2xl border-0 bg-surface-white p-4 text-left shadow-sm transition-all duration-300",
                        selected
                          ? "border-brand/40 bg-brand/[0.03]"
                          : "border-line-soft",
                        editable
                          ? "active:bg-surface-soft"
                          : "cursor-not-allowed opacity-45",
                      ].join(" ")}
                    >
                      <span
                        aria-hidden
                        className={[
                          "mt-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          selected
                            ? "border-brand bg-brand"
                            : "border-line-soft bg-surface-white",
                        ].join(" ")}
                      >
                        {selected ? (
                          <Check className="h-3 w-3 stroke-[3] text-surface-white" />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <PostCard post={post} basePath={basePath} interactive={false} />
                      </div>
                    </button>
                  );
                })
              )}

              {postManageMode ? (
                <button
                  type="button"
                  disabled={selectedPostIds.length === 0}
                  onClick={handleDeleteSelectedPosts}
                  className="mt-1 w-full rounded-xl border border-danger/20 bg-danger/5 py-3 text-sm font-bold text-danger disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {selectedPostIds.length > 0
                    ? `선택한 ${selectedPostIds.length}개 게시글 삭제`
                    : "삭제할 내 글을 선택해 주세요"}
                </button>
              ) : null}
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

      {showPostList && !gated && !postManageMode ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-30 flex justify-center">
          <div className="pointer-events-none w-full max-w-mobile px-5">
            <div className="pointer-events-none flex justify-end">
              <button
                type="button"
                aria-label="글쓰기"
                onClick={() => openWrite(resolveWriteCategory())}
                className="pointer-events-auto flex h-12 min-w-fab items-center justify-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-surface-white shadow-md transition-all duration-300 active:scale-95 active:brightness-95"
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
          onSubmit={async (input) => {
            const created = await addPost(input);
            setWriteOpen(false);
            router.push(`${basePath}/${created.id}`);
          }}
        />
      ) : null}
    </MobileShell>
  );
}
