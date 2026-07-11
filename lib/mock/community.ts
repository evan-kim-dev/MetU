import type { CommunityPost, PostCategory, WritablePostCategory } from "@/lib/community/types";

export type { CommunityPost, PostCategory, WritablePostCategory };

export const CATEGORY_LABELS: Record<PostCategory, string> = {
  all: "전체",
  party: "동행",
  question: "질문",
  review: "후기",
  tip: "꿀팁",
  chat: "잡담",
};

export const CATEGORY_COLORS: Record<WritablePostCategory, string> = {
  party: "bg-brand/10 text-brand-strong",
  question: "bg-surface-soft text-brand-strong",
  review: "bg-emerald-50 text-success",
  tip: "bg-amber-50 text-amber-700",
  chat: "bg-violet-50 text-violet-700",
};

/** Early-access: 데모 게시글 없음 */
export const MOCK_COMMUNITY_POSTS: CommunityPost[] = [];

export function isSeedCommunityPost(post: Pick<CommunityPost, "id" | "authorId">): boolean {
  return (
    post.authorId.startsWith("seed-") ||
    post.id.startsWith("post-party-") ||
    post.id.startsWith("post-tip-") ||
    post.id.startsWith("post-question-") ||
    post.id.startsWith("post-review-")
  );
}
