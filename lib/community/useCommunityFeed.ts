"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { resolveAuthorId } from "@/lib/community/author";
import {
  loadCommunityPosts,
  saveCommunityPosts,
} from "@/lib/community/storage";
import {
  fetchCommunityPostsFromSupabase,
  insertCommunityPostToSupabase,
} from "@/lib/community/supabase";
import type { CommunityPost } from "@/lib/community/types";
import { syncPostCounts } from "@/lib/community/counts";
import { isSeedCommunityPost } from "@/lib/mock/community";
import { STORAGE_KEYS } from "@/lib/constants";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function needsCommunityImmediately(pathname: string) {
  return (
    pathname.startsWith("/board") ||
    pathname.startsWith("/opod") ||
    pathname.startsWith("/notifications")
  );
}

function hasPersistedLocalPosts(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(STORAGE_KEYS.communityPosts));
}

export function useCommunityFeed() {
  const { user, provider, isReady: isAuthReady } = useAuth();
  const { profile } = useProfile();
  const pathname = usePathname();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isReady, setIsReady] = useState(false);

  const userId = user?.id ?? null;
  const useDb = Boolean(userId) && provider !== "guest";

  useEffect(() => {
    if (!isAuthReady) return;

    let cancelled = false;
    const immediate = needsCommunityImmediately(pathname);

    async function load() {
      if (!useDb || !userId) {
        if (!cancelled) {
          setPosts(loadCommunityPosts());
          setIsReady(true);
        }
        return;
      }

      const supabase = getBrowserSupabase();
      if (!supabase) {
        if (!cancelled) {
          setPosts(loadCommunityPosts());
          setIsReady(true);
        }
        return;
      }

      let remote = await fetchCommunityPostsFromSupabase(supabase);
      // DB에 예전 시드가 올라와 있으면 화면에서 제외
      remote = remote.filter((post) => !isSeedCommunityPost(post));

      if (remote.length === 0 && hasPersistedLocalPosts()) {
        const local = loadCommunityPosts().filter(
          (post) => !isSeedCommunityPost(post)
        );
        if (local.length > 0) {
          await Promise.all(
            local.map((post) =>
              insertCommunityPostToSupabase(
                supabase,
                userId,
                profile.name,
                post.avatar,
                {
                  category: post.category,
                  title: post.title,
                  destination: post.destination,
                  body: post.preview,
                  imageUrls: post.images,
                  party: post.party,
                }
              )
            )
          );
          remote = (await fetchCommunityPostsFromSupabase(supabase)).filter(
            (post) => !isSeedCommunityPost(post)
          );
        }
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEYS.communityPosts);
        }
      }

      if (!cancelled) {
        setPosts(remote);
        setIsReady(true);
      }
    }

    if (immediate) {
      void load();
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(() => {
      void load();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isAuthReady, useDb, userId, pathname, profile.name]);

  useEffect(() => {
    if (!isReady || useDb) return;
    saveCommunityPosts(posts.map(syncPostCounts));
  }, [posts, isReady, useDb]);

  const authorId = useMemo(
    () => resolveAuthorId(user, provider),
    [provider, user]
  );

  return {
    posts,
    setPosts,
    isReady,
    useDb,
    userId,
    authorId,
    profile,
  };
}
