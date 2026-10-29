import { LedgerShell } from "@/components/ledger/LedgerShell";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TripLedgerPage({ params }: Props) {
  const { id } = await params;
  return <LedgerShell tripId={id} />;
}
