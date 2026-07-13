"use client";

import { use } from "react";
import { DmChatPageContent } from "@/components/community/DmChatPageContent";

interface OpodDmPageProps {
  params: Promise<{ peerId: string }>;
}

export default function OpodDmPage({ params }: OpodDmPageProps) {
  const { peerId } = use(params);
  return <DmChatPageContent peerId={peerId} />;
}
