import { TripDetailContent } from "@/components/trips/TripDetailContent";

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params;
  return <TripDetailContent tripId={id} />;
}
