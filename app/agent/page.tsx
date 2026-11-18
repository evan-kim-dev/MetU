import { AgentRedirect } from "@/app/agent/AgentRedirect";

/** 구 가계부 허브. Phase 3부터 여행 요약(/trips/[id])으로 soft 리다이렉트. */
export default function AgentPage() {
  return <AgentRedirect />;
}
