import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS App Store 셸 — UI·BFF 는 Vercel 프로덕션을 로드해요.
 * 로컬 `webDir` 은 첫 로드/오프라인 안내용이에요.
 */
const config: CapacitorConfig = {
  appId: "app.metu.ios",
  appName: "MetU",
  webDir: "ios-shell/www",
  server: {
    url: "https://met-u.vercel.app",
    cleartext: false,
    allowNavigation: [
      "met-u.vercel.app",
      "*.supabase.co",
      "*.kakao.com",
      "accounts.kakao.com",
      "kauth.kakao.com",
    ],
  },
  ios: {
    contentInset: "automatic",
    scheme: "MetU",
    preferredContentMode: "mobile",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#F7F8FA",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#F7F8FA",
    },
  },
};

export default config;
