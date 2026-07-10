export interface SmartTip {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

/** 통화 포맷 헬퍼 */
export function formatKRW(value: number): string {
  return `₩${value.toLocaleString("ko-KR")}`;
}
