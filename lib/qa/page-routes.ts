/**
 * Q1 페이지 라우트 인벤토리.
 * 접근 기대는 middleware `isPublicPath` / AuthGate 와 맞춘 문서용 표예요.
 * 코드 동작의 단일 출처는 `lib/auth/route-access.ts` 예요.
 */

export type PageAccess = "public" | "auth" | "auth-or-guest";

export type PageRouteSpec = {
  /** URL 패턴(동적 세그먼트는 [param]) */
  path: string;
  /** app 아래 page.tsx 상대 경로 */
  file: string;
  access: PageAccess;
  note: string;
};

/**
 * git ls-files / Glob 기준 전 page.tsx.
 * 새 페이지를 추가하면 이 목록에 넣고 테스트를 통과시켜요.
 */
export const PAGE_ROUTES: readonly PageRouteSpec[] = [
  {
    path: "/",
    file: "app/page.tsx",
    access: "public",
    note: "홈 · 비로그인 공개(추천딜·랜딩)",
  },
  {
    path: "/about",
    file: "app/about/page.tsx",
    access: "public",
    note: "소개",
  },
  {
    path: "/login",
    file: "app/login/page.tsx",
    access: "public",
    note: "로그인",
  },
  {
    path: "/legal/[slug]",
    file: "app/legal/[slug]/page.tsx",
    access: "public",
    note: "약관·개인정보",
  },
  {
    path: "/join/[token]",
    file: "app/join/[token]/page.tsx",
    access: "public",
    note: "초대 합류(익명 가능)",
  },
  {
    path: "/s/[token]",
    file: "app/s/[token]/page.tsx",
    access: "public",
    note: "정산 공유 읽기 전용",
  },
  {
    path: "/trips/share/[token]",
    file: "app/trips/share/[token]/page.tsx",
    access: "public",
    note: "여행 공유",
  },
  {
    path: "/share-target",
    file: "app/share-target/page.tsx",
    access: "public",
    note: "PWA share_target(미들웨어 공개)",
  },
  {
    path: "/agent",
    file: "app/agent/page.tsx",
    access: "auth-or-guest",
    note: "에이전트 허브",
  },
  {
    path: "/agent/inbox",
    file: "app/agent/inbox/page.tsx",
    access: "auth-or-guest",
    note: "에이전트 인박스",
  },
  {
    path: "/trips",
    file: "app/trips/page.tsx",
    access: "auth-or-guest",
    note: "여행 목록",
  },
  {
    path: "/trips/[id]",
    file: "app/trips/[id]/page.tsx",
    access: "auth-or-guest",
    note: "여행 상세",
  },
  {
    path: "/trips/[id]/ledger",
    file: "app/trips/[id]/ledger/page.tsx",
    access: "auth-or-guest",
    note: "가계부 여정 ?step= ?add= ?settings=",
  },
  {
    path: "/trips/[id]/ledger/connect",
    file: "app/trips/[id]/ledger/connect/page.tsx",
    access: "auth-or-guest",
    note: "자동수집 연결",
  },
  {
    path: "/trips/[id]/ledger/inbox",
    file: "app/trips/[id]/ledger/inbox/page.tsx",
    access: "auth-or-guest",
    note: "원장 인박스",
  },
  {
    path: "/trips/[id]/ledger/settle",
    file: "app/trips/[id]/ledger/settle/page.tsx",
    access: "auth-or-guest",
    note: "정산+송금",
  },
  {
    path: "/trips/[id]/ledger/recap",
    file: "app/trips/[id]/ledger/recap/page.tsx",
    access: "auth-or-guest",
    note: "리캡 K9",
  },
  {
    path: "/trips/[id]/ledger/report",
    file: "app/trips/[id]/ledger/report/page.tsx",
    access: "auth-or-guest",
    note: "리포트",
  },
  {
    path: "/trips/[id]/ledger/wallet",
    file: "app/trips/[id]/ledger/wallet/page.tsx",
    access: "auth-or-guest",
    note: "세금환급 지갑 K6",
  },
  {
    path: "/onboarding",
    file: "app/onboarding/page.tsx",
    access: "auth-or-guest",
    note: "온보딩",
  },
  {
    path: "/onboarding/automation",
    file: "app/onboarding/automation/page.tsx",
    access: "auth-or-guest",
    note: "자동화 온보딩",
  },
  {
    path: "/onboarding/result",
    file: "app/onboarding/result/page.tsx",
    access: "auth-or-guest",
    note: "온보딩 결과",
  },
  {
    path: "/onboarding/shortcut-guide",
    file: "app/onboarding/shortcut-guide/page.tsx",
    access: "auth-or-guest",
    note: "단축어 안내",
  },
  {
    path: "/profile",
    file: "app/profile/page.tsx",
    access: "auth-or-guest",
    note: "프로필",
  },
  {
    path: "/notifications",
    file: "app/notifications/page.tsx",
    access: "auth-or-guest",
    note: "알림",
  },
  {
    path: "/checklist/[category]",
    file: "app/checklist/[category]/page.tsx",
    access: "auth-or-guest",
    note: "체크리스트",
  },
  {
    path: "/board",
    file: "app/board/page.tsx",
    access: "auth-or-guest",
    note: "커뮤니티 보드",
  },
  {
    path: "/board/[id]",
    file: "app/board/[id]/page.tsx",
    access: "auth-or-guest",
    note: "게시글",
  },
  {
    path: "/board/[id]/chat",
    file: "app/board/[id]/chat/page.tsx",
    access: "auth-or-guest",
    note: "보드 채팅",
  },
  {
    path: "/opod",
    file: "app/opod/page.tsx",
    access: "auth-or-guest",
    note: "오픈팟",
  },
  {
    path: "/opod/[id]",
    file: "app/opod/[id]/page.tsx",
    access: "auth-or-guest",
    note: "오픈팟 상세",
  },
  {
    path: "/opod/[id]/chat",
    file: "app/opod/[id]/chat/page.tsx",
    access: "auth-or-guest",
    note: "오픈팟 채팅",
  },
  {
    path: "/opod/dm/[peerId]",
    file: "app/opod/dm/[peerId]/page.tsx",
    access: "auth-or-guest",
    note: "DM",
  },
  {
    path: "/users/[id]",
    file: "app/users/[id]/page.tsx",
    access: "auth-or-guest",
    note: "사용자 프로필",
  },
] as const;

/** 딥링크 쿼리(여정). 수동·스모크 체크용. */
export const LEDGER_DEEP_LINKS = [
  "?step=connect",
  "?step=invite",
  "?step=record",
  "?step=adjust",
  "?step=settle",
  "?step=pay",
  "?add=receipt",
  "?add=manual",
  "?add=voice",
  "?settings=",
] as const;
