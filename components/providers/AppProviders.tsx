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
import { SectionErrorBoundary } from "@/components/ui/SectionErrorBoundary";

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
              <SectionErrorBoundary
                fallbackTitle="여행 데이터를 불러오지 못했어요"
                fallbackMessage="홈으로 돌아가거나 다시 시도해 주세요. 로그인 상태는 유지돼요."
              >
                <TripProvider>
                  <SectionErrorBoundary
                    fallbackTitle="커뮤니티를 불러오지 못했어요"
                    fallbackMessage="다른 메뉴는 계속 사용할 수 있어요."
                  >
                    <CommunityProvider>
                      <div className="flex min-h-0 flex-1 flex-col">
                        {children}
                      </div>
                    </CommunityProvider>
                  </SectionErrorBoundary>
                </TripProvider>
              </SectionErrorBoundary>
            </FriendsProvider>
          </ProfileProvider>
        </AuthGate>
        <InstallBanner />
      </AuthProvider>
    </EasterEggToastProvider>
  );
}
