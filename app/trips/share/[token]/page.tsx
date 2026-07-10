import { SharedTripContent } from "@/components/trips/SharedTripContent";

interface SharedTripPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedTripPage({ params }: SharedTripPageProps) {
  const { token } = await params;
  return <SharedTripContent token={token} />;
}
