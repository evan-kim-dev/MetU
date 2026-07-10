"use client";

import { use } from "react";
import { PartyChatPageContent } from "@/components/community/PartyChatPageContent";

interface OpodChatPageProps {
  params: Promise<{ id: string }>;
}

export default function OpodChatPage({ params }: OpodChatPageProps) {
  const { id } = use(params);
  return <PartyChatPageContent postId={id} listHref="/opod" />;
}
