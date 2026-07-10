"use client";

import { use } from "react";
import { PartyChatPageContent } from "@/components/community/PartyChatPageContent";

interface BoardChatPageProps {
  params: Promise<{ id: string }>;
}

export default function BoardChatPage({ params }: BoardChatPageProps) {
  const { id } = use(params);
  return <PartyChatPageContent postId={id} listHref="/board" />;
}
