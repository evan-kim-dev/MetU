/**
 * 데모 모드 스위치.
 *
 * - `NEXT_PUBLIC_DEMO_MODE=1` 일 때만 데모 패널(UI)과 데모 라우트(seed/notify)가 살아 있어요.
 * - NEXT_PUBLIC_ 변수는 **빌드 타임에 인라인**돼요. Vercel 에 설정/변경한 뒤에는 재배포해야 반영돼요.
 * - 꺼진 환경에서 데모 라우트는 404 를 돌려줘서 존재 자체를 드러내지 않아요.
 *
 * 비밀값이 아니에요(켜짐/꺼짐 플래그). 반드시 정적 참조로 읽어야 클라이언트 번들에도 인라인돼요.
 */
export function isDemoModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1";
}