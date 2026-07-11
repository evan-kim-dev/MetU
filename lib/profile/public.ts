import type { TravelStyle } from "@/components/onboarding/types";

export interface PublicProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string;
  homeCity: string;
  styles: TravelStyle[];
  membershipLabel: string;
}

export function isAvatarImage(src: string): boolean {
  const value = src.trim();
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("/")
  );
}
