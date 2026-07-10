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
  title: "MetU",
  description: "예산 기반 AI 여행 플래너",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#F8F9FF", // surface.base
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
        <div className="flex min-h-dvh justify-center bg-canvas">
          <div className="relative flex h-dvh w-full max-w-mobile flex-col overflow-hidden bg-surface-base shadow-soft">
            <AppProviders>{children}</AppProviders>
          </div>
        </div>
      </body>
    </html>
  );
}
