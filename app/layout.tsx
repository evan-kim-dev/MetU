import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BudgetTrip AI",
  description: "예산 기반 AI 여행 플래너",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#F8F9FF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={jakarta.variable} suppressHydrationWarning>
      <body>
        {/* 데스크톱에서도 모바일 캔버스를 중앙 정렬하기 위한 바깥 래퍼 */}
        <div className="flex min-h-dvh justify-center bg-[#E9EDF7]">
          <div className="relative flex min-h-dvh w-full max-w-mobile flex-col overflow-x-hidden bg-surface-base shadow-soft">
            <AppProviders>{children}</AppProviders>
          </div>
        </div>
      </body>
    </html>
  );
}
