import { AgentInbox } from "@/components/agent/AgentInbox";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LedgerInboxPage({ params }: Props) {
  const { id } = await params;
  return <AgentInbox tripId={id} />;
}
