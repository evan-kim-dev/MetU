"use client";

import { use } from "react";
import { PostDetailContent } from "@/components/community/PostDetailContent";

interface BoardPostDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function BoardPostDetailPage({ params }: BoardPostDetailPageProps) {
  const { id } = use(params);
  return <PostDetailContent postId={id} listHref="/board" />;
}
