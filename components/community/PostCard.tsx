import Link from "next/link";
import { CalendarDays, Heart, MessageCircle, Users, Wallet } from "lucide-react";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type CommunityPost,
} from "@/lib/mock/community";
import { PostImageGallery } from "@/components/community/PostImageGallery";
import { getCommentCount, getLikeCount } from "@/lib/community/counts";
import { formatPartyBudgetPerPerson } from "@/lib/community/format";

interface PostCardProps {
  post: CommunityPost;
  basePath?: "/opod" | "/board";
  /** false면 링크/카드 테두리 없이 내용만 렌더 (선택 모드용) */
  interactive?: boolean;
}

function formatDateRange(start: string, end: string): string {
  const startLabel = start.slice(5).replace("-", "/");
  const endLabel = end.slice(5).replace("-", "/");
  return `${startLabel} ~ ${endLabel}`;
}

export function PostCard({
  post,
  basePath = "/board",
  interactive = true,
}: PostCardProps) {
  const isParty = post.category === "party" && post.party;
  const likeCount = getLikeCount(post);
  const commentCount = getCommentCount(post);

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-soft text-base">
            {post.avatar}
          </span>
          <div>
            <p className="text-sm font-bold text-ink-heading">{post.author}</p>
            <p className="text-xs text-ink-caption">{post.createdAt}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${CATEGORY_COLORS[post.category]}`}
        >
          {CATEGORY_LABELS[post.category]}
        </span>
      </div>

      {isParty ? (
        <div className="rounded-lg border border-brand/15 bg-surface-soft px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-brand-strong">
              {post.party!.current}/{post.party!.needed}명 모집중
            </p>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[10px] font-bold text-white",
                post.party!.current >= post.party!.needed
                  ? "bg-ink-caption"
                  : "bg-brand",
              ].join(" ")}
            >
              {post.party!.current >= post.party!.needed ? "FULL" : "OPEN"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-ink-body">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDateRange(post.party!.startDate, post.party!.endDate)}
            </span>
            {post.party!.budgetPerPerson ? (
              <span className="inline-flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" />
                1인 {formatPartyBudgetPerPerson(post.party!.budgetPerPerson)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {post.party!.needed - post.party!.current}명 남음
            </span>
          </div>
        </div>
      ) : null}

      <div>
        <span className="text-xs font-semibold text-brand">{post.destination}</span>
        <h3 className="mt-0.5 text-base font-extrabold leading-snug text-ink-heading">
          {post.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-caption">
          {post.preview}
        </p>
      </div>

      {post.images && post.images.length > 0 ? (
        <PostImageGallery images={post.images} variant="card" />
      ) : null}

      <div className="flex items-center gap-4 text-xs font-semibold text-ink-caption">
        <span className="flex items-center gap-1">
          <Heart className="h-4 w-4" />
          {likeCount}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="h-4 w-4" />
          {commentCount}
        </span>
      </div>
    </>
  );

  if (!interactive) {
    return <div className="flex flex-col gap-3 py-1">{content}</div>;
  }

  return (
    <Link
      href={`${basePath}/${post.id}`}
      className={[
        "flex flex-col gap-3 rounded-xl2 border bg-surface-white p-4 shadow-soft transition-transform active:scale-[0.99]",
        isParty ? "border-brand/20" : "border-line-soft",
      ].join(" ")}
    >
      {content}
    </Link>
  );
}
