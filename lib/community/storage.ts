import { STORAGE_KEYS } from "@/lib/constants";
import { isSeedCommunityPost } from "@/lib/mock/community";
import { syncPostCounts } from "./counts";
import type { CommunityPost } from "./types";

const STORAGE_KEY = STORAGE_KEYS.communityPosts;

function normalizeParty(post: CommunityPost): CommunityPost {
  if (!post.party) return post;

  const members = post.party.members ?? [];
  if (members.length === 0 && post.party.current > 0) {
    members.push({
      id: post.authorId,
      name: post.author,
      avatar: post.avatar,
      joinedAtIso: post.createdAtIso,
      isHost: true,
    });
  }

  return {
    ...post,
    party: {
      ...post.party,
      members,
      current: members.length > 0 ? members.length : post.party.current,
    },
  };
}

function normalizePost(post: CommunityPost): CommunityPost {
  const commentList = (post.commentList ?? []).map((comment) => {
    const likedBy = comment.likedBy ?? [];
    return {
      ...comment,
      likedBy,
      likes: Math.max(comment.likes ?? 0, likedBy.length),
    };
  });
  const likedBy = post.likedBy ?? [];
  const base = syncPostCounts({
    ...post,
    commentList,
    likedBy,
  });
  return normalizeParty(base);
}

export function loadCommunityPosts(): CommunityPost[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommunityPost[];
    if (!Array.isArray(parsed)) return [];

    const cleaned = parsed
      .filter((post) => !isSeedCommunityPost(post))
      .map(normalizePost);

    // 예전 데모 글이 남아 있으면 저장본도 정리
    if (cleaned.length !== parsed.length) {
      saveCommunityPosts(cleaned);
    }

    return cleaned;
  } catch {
    return [];
  }
}

export function saveCommunityPosts(posts: CommunityPost[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(posts.filter((post) => !isSeedCommunityPost(post)))
  );
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
