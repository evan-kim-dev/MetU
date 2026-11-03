import { Suspense } from "react";
import { TripJourney } from "@/components/ledger/journey/TripJourney";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TripLedgerPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="mx-auto h-48 max-w-mobile animate-pulse rounded-2xl bg-mu-sunken" />
      }
    >
      <TripJourney tripId={id} />
    </Suspense>
  );
}
