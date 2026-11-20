# MetU iOS App Store 셸 (Capacitor)

웹(PWA)·Vercel BFF 는 그대로 두고, Capacitor WKWebView 가 `https://met-u.vercel.app` 을 로드하는 **네이티브 셸**이에요.  
이 문서는 Xcode / TestFlight 뼈대용이에요. 네이티브 푸시·Share Extension·Apple 4.2 대응은 후속 작업입니다.

## 사전 조건

- macOS + **Xcode** (Command Line Tools 만으로는 `pod install` / Archive 불가)
- [CocoaPods](https://capacitorjs.com/docs/getting-started/environment-setup#homebrew)
- Apple Developer 계정 (Signing / TestFlight)
- 로컬: `npm install` (프로젝트 규칙상 `package-lock.json` 변경은 커밋하지 않아요)

## 한 번에 열기

```bash
npm install
npm run cap:sync
npm run cap:open:ios
```

Xcode 에서 **Signing & Capabilities → Team** 을 선택한 뒤 시뮬레이터 또는 기기로 Run.

## 구성 요약

| 항목 | 값 |
| --- | --- |
| Bundle ID | `app.metu.ios` |
| Display name | MetU |
| 로드 URL | `https://met-u.vercel.app` ([`capacitor.config.ts`](../capacitor.config.ts)) |
| 로컬 webDir | `ios-shell/www` (오프라인/첫 로드 안내) |
| 방향 | Portrait |

OAuth(카카오·Supabase) 리다이렉트는 프로덕션 오리진을 유지해요 → [`lib/site-url.ts`](../lib/site-url.ts).  
`server.allowNavigation` 에 `*.supabase.co`, `*.kakao.com` 등이 포함돼 있어요.

## TestFlight / Archive

1. Xcode → Product → Archive
2. Organizer → Distribute App → App Store Connect
3. TestFlight 에 빌드가 뜨면 내부 테스터 초대

스토어 메타데이터·스크린샷·심사는 이 레포 밖 작업이에요.

## 한계 (알아둘 것)

- **Apple Guideline 4.2**: 기능이 거의 없는 웹뷰 래퍼는 거절될 수 있어요. 푸시·딥링크·Share 등 네이티브 가치를 후속으로 붙이는 걸 권장해요.
- 이 머신에 Xcode.app 이 없으면 `npx cap sync ios` 의 `pod install` 단계가 실패할 수 있어요. Xcode 설치 후 `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` 한 뒤 다시 sync 하세요.
- Android / Play Store 는 이번 범위에 없어요.
- 웹 PWA(`public/sw.js`, 홈 화면 추가)는 유지해요. Capacitor 앱 안에서는 설치 배너를 숨겨요.

## 관련 경로

- [`capacitor.config.ts`](../capacitor.config.ts)
- [`ios/`](../ios/) — Xcode 프로젝트
- [`ios-shell/www/`](../ios-shell/www/) — 로컬 스플래시 HTML
- [`lib/native/capacitor.ts`](../lib/native/capacitor.ts) — `isNativeApp()`
