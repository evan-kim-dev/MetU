/** Shared currency formatting */
export function formatKRW(value: number): string {
  return `₩${value.toLocaleString("ko-KR")}`;
}
