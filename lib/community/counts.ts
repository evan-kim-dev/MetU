import type { CommunityPost } from "./types";

/** 게시글 좋아요 수 — likedBy와 likes 필드를 항상 맞춘다 */
export function getLikeCount(post: CommunityPost): number {
  const likedBy = post.likedBy ?? [];
  if (likedBy.length === 0) return post.likes ?? 0;
  // likedBy가 있으면 실제 토글 반영값(likes)을 우선, 없으면 likedBy 길이
  return Math.max(post.likes ?? 0, likedBy.length);
}

/** 게시글 댓글 수 — commentList가 단일 기준 */
export function getCommentCount(post: CommunityPost): number {
  return (post.commentList ?? []).length;
}

export function syncPostCounts(post: CommunityPost): CommunityPost {
  return {
    ...post,
    likes: getLikeCount(post),
    comments: getCommentCount(post),
  };
}
