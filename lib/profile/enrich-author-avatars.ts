import type { CommunityPost } from "@/lib/community/types";
import type { PublicProfile } from "@/lib/profile/public";
import { isAvatarImage } from "@/lib/profile/public";

export const PROFILE_USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isProfileUserId(id: string): boolean {
  return PROFILE_USER_ID_RE.test(id.trim());
}

export function collectAuthorIdsFromPosts(posts: CommunityPost[]): string[] {
  const ids = new Set<string>();
  for (const post of posts) {
    if (isProfileUserId(post.authorId)) ids.add(post.authorId);
    for (const comment of post.commentList ?? []) {
      if (isProfileUserId(comment.authorId)) ids.add(comment.authorId);
    }
    for (const member of post.party?.members ?? []) {
      if (isProfileUserId(member.id)) ids.add(member.id);
    }
    for (const member of post.party?.pendingMembers ?? []) {
      if (isProfileUserId(member.id)) ids.add(member.id);
    }
  }
  return [...ids];
}

function resolveAvatar(
  profileAvatar: string | null | undefined,
  fallback: string
): string {
  const fromProfile = profileAvatar?.trim() || "";
  if (isAvatarImage(fromProfile)) return fromProfile;
  return fallback;
}

export function enrichPostsWithAuthorProfiles(
  posts: CommunityPost[],
  profilesById: Record<string, PublicProfile>
): CommunityPost[] {
  if (posts.length === 0 || Object.keys(profilesById).length === 0) {
    return posts;
  }

  let changed = false;

  const next = posts.map((post) => {
    let nextPost = post;
    const author = profilesById[post.authorId];

    if (author) {
      const nextAvatar = resolveAvatar(author.avatarUrl, post.avatar);
      const nextName = author.name.trim() || post.author;
      if (nextAvatar !== post.avatar || nextName !== post.author) {
        changed = true;
        nextPost = {
          ...nextPost,
          author: nextName,
          avatar: nextAvatar,
        };
      }
    }

    let commentsChanged = false;
    const comments = (nextPost.commentList ?? []).map((comment) => {
      const profile = profilesById[comment.authorId];
      if (!profile) return comment;
      const nextAvatar = resolveAvatar(profile.avatarUrl, comment.avatar);
      const nextName = profile.name.trim() || comment.author;
      if (nextAvatar === comment.avatar && nextName === comment.author) {
        return comment;
      }
      commentsChanged = true;
      return {
        ...comment,
        author: nextName,
        avatar: nextAvatar,
      };
    });

    if (commentsChanged) {
      changed = true;
      nextPost = { ...nextPost, commentList: comments };
    }

    if (nextPost.party) {
      let partyChanged = false;

      const members = nextPost.party.members.map((member) => {
        const profile = profilesById[member.id];
        if (!profile) return member;
        const nextAvatar = resolveAvatar(profile.avatarUrl, member.avatar);
        const nextName = profile.name.trim() || member.name;
        if (nextAvatar === member.avatar && nextName === member.name) {
          return member;
        }
        partyChanged = true;
        return { ...member, avatar: nextAvatar, name: nextName };
      });

      const pendingMembers = (nextPost.party.pendingMembers ?? []).map(
        (member) => {
          const profile = profilesById[member.id];
          if (!profile) return member;
          const nextAvatar = resolveAvatar(profile.avatarUrl, member.avatar);
          const nextName = profile.name.trim() || member.name;
          if (nextAvatar === member.avatar && nextName === member.name) {
            return member;
          }
          partyChanged = true;
          return { ...member, avatar: nextAvatar, name: nextName };
        }
      );

      if (partyChanged) {
        changed = true;
        nextPost = {
          ...nextPost,
          party: {
            ...nextPost.party,
            members,
            pendingMembers,
          },
        };
      }
    }

    return nextPost;
  });

  return changed ? next : posts;
}

export async function fetchAuthorProfilesByIds(
  ids: string[]
): Promise<Record<string, PublicProfile>> {
  const unique = [...new Set(ids.filter(isProfileUserId))];
  if (unique.length === 0) return {};

  try {
    const res = await fetch("/api/users/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unique }),
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      profiles?: Record<string, PublicProfile>;
    };
    return data.profiles ?? {};
  } catch {
    return {};
  }
}
