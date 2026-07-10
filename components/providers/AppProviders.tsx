import { ProfileProvider } from "@/lib/profile/ProfileProvider";
import { TripProvider } from "@/lib/trips/TripProvider";
import { CommunityProvider } from "@/lib/community/CommunityProvider";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { AuthGate } from "@/components/auth/AuthGate";
import { BuildRevalidator } from "@/components/ui/BuildRevalidator";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <BuildRevalidator />
      <AuthGate>
        <ProfileProvider>
          <TripProvider>
            <CommunityProvider>
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            </CommunityProvider>
          </TripProvider>
        </ProfileProvider>
      </AuthGate>
    </AuthProvider>
  );
}
