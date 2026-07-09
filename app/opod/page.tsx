"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PostCard } from "@/components/community/PostCard";
import { WritePostSheet } from "@/components/community/WritePostSheet";
import { useCommunity } from "@/lib/community/CommunityProvider";
import {
  CATEGORY_LABELS,
  type PostCategory,
  type WritablePostCategory,
} from "@/lib/mock/community";

const CATEGORIES: PostCategory[] = ["all", "party", "question", "review", "tip"];

export default function OpodPage() {
  const router = useRouter();
  const { posts, isReady, addPost } = useCommunity();
  const [activeCategory, setActiveCategory] = useState<PostCategory>("all");
  const [writeOpen, setWriteOpen] = useState(false);
  const [writeCategory, setWriteCategory] = useState<WritablePostCategory>("party");

  const filteredPosts = useMemo(() => {
    if (activeCategory === "all") return posts;
    return posts.filter((post) => post.category === activeCategory);
  }, [activeCategory, posts]);

  function openWrite(category: WritablePostCategory = "party") {
    setWriteCategory(category);
    setWriteOpen(true);
  }

  return (
    <MobileShell title="ㅇ팟">
      <div className="flex flex-col gap-5 px-5 pb-20 pt-5">
        <p className="text-sm leading-relaxed text-ink-caption">
          여행자들과 예산·코스·후기를 나누고, 같이 갈 동행도 구해보세요.
        </p>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((category) => {
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
                      ? "bg-violet-600 text-surface-white shadow-soft"
                      : "bg-brand text-surface-white shadow-soft"
                    : "border border-line-soft bg-surface-white text-ink-caption",
                ].join(" ")}
              >
                {CATEGORY_LABELS[category]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          {!isReady ? (
            <p className="py-10 text-center text-sm text-ink-caption">불러오는 중...</p>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-xl2 border border-dashed border-line-soft px-4 py-10 text-center">
              <p className="text-sm font-semibold text-ink-heading">
                아직 게시글이 없어요
              </p>
              <button
                type="button"
                onClick={() => openWrite(activeCategory === "all" ? "party" : activeCategory)}
                className="mt-3 text-sm font-bold text-brand"
              >
                첫 글 작성하기
              </button>
            </div>
          ) : (
            filteredPosts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-30 flex justify-center">
        <div className="pointer-events-none w-full max-w-mobile px-5">
          <div className="pointer-events-none flex justify-end">
            <button
              type="button"
              aria-label="글쓰기"
              onClick={() => openWrite("question")}
              className="pointer-events-auto flex h-12 min-w-[48px] items-center justify-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-surface-white shadow-soft transition-all active:scale-95 active:brightness-95"
            >
              <PenLine className="h-5 w-5" strokeWidth={2.4} />
              <span>글쓰기</span>
            </button>
          </div>
        </div>
      </div>

      <WritePostSheet
        open={writeOpen}
        initialCategory={writeCategory}
        onClose={() => setWriteOpen(false)}
        onSubmit={(input) => {
          const created = addPost(input);
          setWriteOpen(false);
          router.push(`/opod/${created.id}`);
        }}
      />
    </MobileShell>
  );
}
