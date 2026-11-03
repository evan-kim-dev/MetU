import { LedgerInboxClient } from "@/components/ledger/LedgerInboxClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LedgerInboxPage({ params }: Props) {
  const { id } = await params;
  return <LedgerInboxClient tripId={id} />;
}
