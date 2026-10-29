import { ConnectIngestPanel } from "@/components/agent/ConnectIngestPanel";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LedgerConnectPage({ params }: Props) {
  const { id } = await params;
  return <ConnectIngestPanel tripId={id} />;
}
