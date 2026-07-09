"use client";

import { use } from "react";
import { PostDetailContent } from "@/components/community/PostDetailContent";

interface PostDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function PostDetailPage({ params }: PostDetailPageProps) {
  const { id } = use(params);
  return <PostDetailContent postId={id} />;
}
