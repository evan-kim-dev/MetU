"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Heart,
  MessageCircle,
  Pencil,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { WritePostSheet } from "@/components/community/WritePostSheet";
import { PostImageGallery } from "@/components/community/PostImageGallery";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from "@/lib/mock/community";
import { useCommunity } from "@/lib/community/CommunityProvider";
import { getCommentCount, getLikeCount } from "@/lib/community/counts";
import { formatPartyBudgetPerPerson } from "@/lib/community/format";

interface PostDetailContentProps {
  postId: string;
  listHref?: "/opod" | "/board";
}

function formatDateRange(start: string, end: string): string {
  return `${start.replaceAll("-", ".")} ~ ${end.replaceAll("-", ".")}`;
}

export function PostDetailContent({
  postId,
  listHref = "/board",
}: PostDetailContentProps) {
  const router = useRouter();
  const {
    getPost,
    updatePost,
    removePost,
    canEdit,
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
  } = useCommunity();
  const post = getPost(postId);
  const [commentDraft, setCommentDraft] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentEditDraft, setCommentEditDraft] = useState("");

  if (!post) {
    return (
      <MobileShell title="게시글" showBack backHref={listHref}>
        <div className="flex flex-col items-center gap-4 px-5 py-20 text-center">
          <p className="text-base font-bold text-ink-heading">
            게시글을 찾을 수 없어요
          </p>
          <PrimaryButton fullWidth={false} className="px-6" onClick={() => router.push(listHref)}>
            {listHref === "/board" ? "게시판으로 돌아가기" : "멧톡으로 돌아가기"}
          </PrimaryButton>
        </div>
      </MobileShell>
    );
  }

  const editable = canEdit(post);
  const isParty = post.category === "party" && post.party;
  const liked = isLiked(post);
  const joined = isParty ? isPartyJoined(post) : false;
  const isHost = isParty ? isPartyHost(post) : false;
  const isFull = isParty ? isPartyFull(post) : false;
  const slotsLeft = isParty ? post.party!.needed - post.party!.current : 0;
  const likeCount = getLikeCount(post);
  const commentCount = getCommentCount(post);

  function handleDelete() {
    if (!editable || !post) return;
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

  return (
    <MobileShell
      title="게시글"
      showBack
      backHref={listHref}
      showBottomNav={false}
      rightSlot={
        editable ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="게시글 수정"
              onClick={() => setEditOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-body"
            >
              <Pencil className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="게시글 삭제"
              onClick={handleDelete}
              className="flex h-9 w-9 items-center justify-center rounded-full text-danger"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ) : undefined
      }
    >
      <article className="flex flex-col gap-5 px-5 pb-10 pt-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-soft text-lg">
              {post.avatar}
            </span>
            <div>
              <p className="text-sm font-bold text-ink-heading">{post.author}</p>
              <p className="text-xs text-ink-caption">{post.createdAt}</p>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${CATEGORY_COLORS[post.category]}`}
          >
            {CATEGORY_LABELS[post.category]}
          </span>
        </div>

        <div>
          <span className="text-xs font-semibold text-brand">{post.destination}</span>
          <h1 className="mt-1 text-2xl font-extrabold leading-snug text-ink-heading">
            {post.title}
          </h1>
        </div>

        <p className="whitespace-pre-wrap text-base leading-relaxed text-ink-body">
          {post.preview}
        </p>

        {post.images && post.images.length > 0 ? (
          <PostImageGallery images={post.images} variant="detail" />
        ) : null}

        {isParty ? (
          <section className="rounded-xl2 border border-brand/20 bg-surface-soft p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold text-brand-strong">동행 모집 정보</p>
              <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white">
                {post.party!.current}/{post.party!.needed}명
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm font-semibold text-ink-heading">
              <p className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {formatDateRange(post.party!.startDate, post.party!.endDate)}
              </p>
              <p className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                {post.party!.needed - post.party!.current}명 더 모집 중
              </p>
              {post.party!.budgetPerPerson ? (
                <p className="inline-flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  1인 예산 {formatPartyBudgetPerPerson(post.party!.budgetPerPerson)}
                </p>
              ) : null}
            </div>

            <div className="mt-4 border-t border-brand/20 pt-3">
              <p className="mb-2 text-xs font-bold text-brand-strong">참여 멤버</p>
              <ul className="flex flex-col gap-2">
                {post.party!.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-2"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-sm">
                      {member.avatar}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink-heading">
                        {member.name}
                        {member.isHost ? (
                          <span className="ml-1.5 text-[10px] font-bold text-brand">
                            HOST
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              {isHost ? (
                <p className="rounded-lg bg-white/80 px-3 py-2.5 text-center text-sm font-semibold text-brand-strong">
                  내가 모집 중인 동행이에요
                </p>
              ) : joined ? (
                <button
                  type="button"
                  onClick={() => leaveParty(post.id)}
                  className="w-full rounded-lg border border-line-soft bg-white py-3 text-sm font-bold text-brand-strong"
                >
                  참여 취소
                </button>
              ) : isFull ? (
                <p className="rounded-lg bg-ink-caption/10 px-3 py-2.5 text-center text-sm font-semibold text-ink-caption">
                  모집이 마감됐어요
                </p>
              ) : (
                <PrimaryButton
                  className="h-11 min-h-[44px] rounded-xl bg-brand text-sm"
                  onClick={() => joinParty(post.id)}
                >
                  동행 참여하기 ({slotsLeft}명 남음)
                </PrimaryButton>
              )}
            </div>

            {isHost || joined ? (
              <button
                type="button"
                onClick={() => router.push(`${listHref}/${post.id}/chat`)}
                className="mt-2 w-full rounded-lg bg-brand-strong py-3 text-sm font-bold text-white"
              >
                오픈채팅방 입장
              </button>
            ) : null}
          </section>
        ) : null}

        <section className="flex flex-col gap-4 border-t border-line-soft pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4.5 w-4.5 text-ink-body" />
              <h2 className="text-base font-bold text-ink-heading">
                댓글 {commentCount}
              </h2>
            </div>
            <button
              type="button"
              aria-label={liked ? "좋아요 취소" : "좋아요"}
              aria-pressed={liked}
              onClick={() => toggleLike(post.id)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors",
                liked
                  ? "bg-rose-50 text-rose-600"
                  : "bg-surface-soft text-ink-caption hover:text-ink-body",
              ].join(" ")}
            >
              <Heart
                className={[
                  "h-5 w-5 transition-colors",
                  liked ? "fill-rose-500 text-rose-500" : "",
                ].join(" ")}
                strokeWidth={2.2}
              />
              {likeCount}
            </button>
          </div>

          {post.commentList.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-caption">
              아직 댓글이 없어요. 첫 댓글을 남겨보세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {post.commentList.map((comment) => {
                const manageable = canManageComment(comment);
                const isEditing = editingCommentId === comment.id;

                return (
                  <li
                    key={comment.id}
                    className="rounded-xl2 border border-line-soft bg-surface-white px-3.5 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-soft text-sm">
                          {comment.avatar}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-ink-heading">
                            {comment.author}
                          </p>
                          <p className="text-[11px] text-ink-caption">
                            {comment.createdAt}
                          </p>
                        </div>
                      </div>
                      {manageable && !isEditing ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleStartEditComment(comment.id, comment.content)
                            }
                            className="rounded-md px-2 py-1 text-xs font-semibold text-ink-body"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="rounded-md px-2 py-1 text-xs font-semibold text-danger"
                          >
                            삭제
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="mt-2">
                        <textarea
                          value={commentEditDraft}
                          onChange={(e) => setCommentEditDraft(e.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-lg border border-line-soft px-3 py-2.5 text-sm text-ink-body outline-none focus:border-brand"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveComment(comment.id)}
                            disabled={!commentEditDraft.trim()}
                            className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(null);
                              setCommentEditDraft("");
                            }}
                            className="rounded-lg border border-line-soft px-3 py-2 text-xs font-semibold text-ink-body"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-body">
                        {comment.content}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="rounded-xl2 border border-line-soft bg-surface-white p-3">
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={3}
              placeholder="댓글을 입력하세요"
              className="w-full resize-none rounded-lg border border-line-soft px-3 py-2.5 text-sm text-ink-body outline-none focus:border-brand"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
            />
            <PrimaryButton
              className="mt-2 h-11 min-h-[44px] rounded-xl text-sm"
              disabled={!commentDraft.trim()}
              onClick={handleSubmitComment}
            >
              댓글 등록
            </PrimaryButton>
          </div>
        </section>
      </article>

      <WritePostSheet
        open={editOpen}
        editingPost={post}
        onClose={() => setEditOpen(false)}
        onSubmit={(input) => {
          updatePost(post.id, input);
          setEditOpen(false);
        }}
      />
    </MobileShell>
  );
}
