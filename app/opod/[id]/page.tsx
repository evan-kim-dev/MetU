"use client";

import { use } from "react";
import { PostDetailContent } from "@/components/community/PostDetailContent";

interface OpodPostDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OpodPostDetailPage({ params }: OpodPostDetailPageProps) {
  const { id } = use(params);
  return <PostDetailContent postId={id} listHref="/opod" />;
}
