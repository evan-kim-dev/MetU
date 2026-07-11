import { ProfileProvider } from "@/lib/profile/ProfileProvider";
import { TripProvider } from "@/lib/trips/TripProvider";
import { CommunityProvider } from "@/lib/community/CommunityProvider";
import { FriendsProvider } from "@/lib/friends/FriendsProvider";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { AuthGate } from "@/components/auth/AuthGate";
import { BuildRevalidator } from "@/components/ui/BuildRevalidator";
import { BuildStamp } from "@/components/ui/BuildStamp";
import { EasterEggToastProvider } from "@/components/ui/EasterEggToast";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <EasterEggToastProvider>
      <AuthProvider>
        <ServiceWorkerRegister />
        <BuildRevalidator />
        <BuildStamp />
        <AuthGate>
          <ProfileProvider>
            <FriendsProvider>
              <TripProvider>
                <CommunityProvider>
                  <div className="flex min-h-0 flex-1 flex-col">{children}</div>
                </CommunityProvider>
              </TripProvider>
            </FriendsProvider>
          </ProfileProvider>
        </AuthGate>
        <InstallBanner />
      </AuthProvider>
    </EasterEggToastProvider>
  );
}
