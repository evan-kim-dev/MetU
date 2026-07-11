import { PublicProfileContent } from "@/components/profile/PublicProfileContent";

interface UserProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { id } = await params;
  return <PublicProfileContent userId={decodeURIComponent(id)} />;
}
