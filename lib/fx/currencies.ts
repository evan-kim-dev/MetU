export type FxCurrency = "USD" | "JPY" | "EUR" | "GBP" | "THB" | "VND" | "TWD" | "CAD" | "AUD";

export interface FxTarget {
  code: FxCurrency;
  /** 표시용 심볼 (1$ 의 $) */
  symbol: string;
  /** 몇 단위를 1로 볼지 (엔은 보통 100엔 단위로 보여주기도 함) */
  unit: number;
  label: string;
}

const COUNTRY_FX: Array<{ match: string[]; fx: FxTarget }> = [
  {
    match: ["일본", "japan", "도쿄", "오사카", "tokyo", "osaka"],
    fx: { code: "JPY", symbol: "¥", unit: 100, label: "엔" },
  },
  {
    match: ["미국", "usa", "united states", "뉴욕", "new york"],
    fx: { code: "USD", symbol: "$", unit: 1, label: "달러" },
  },
  {
    match: ["영국", "uk", "영국", "런던", "london", "england"],
    fx: { code: "GBP", symbol: "£", unit: 1, label: "파운드" },
  },
  {
    match: ["프랑스", "france", "파리", "paris", "이탈리아", "italy", "로마", "rome", "유로"],
    fx: { code: "EUR", symbol: "€", unit: 1, label: "유로" },
  },
  {
    match: ["태국", "thailand", "방콕", "bangkok"],
    fx: { code: "THB", symbol: "฿", unit: 10, label: "밧" },
  },
  {
    match: ["베트남", "vietnam", "다낭", "하노이", "호치민", "danang"],
    fx: { code: "VND", symbol: "₫", unit: 10000, label: "동" },
  },
  {
    match: ["대만", "taiwan", "타이베이", "taipei"],
    fx: { code: "TWD", symbol: "NT$", unit: 10, label: "대만달러" },
  },
  {
    match: ["캐나다", "canada", "몬트리올", "toronto"],
    fx: { code: "CAD", symbol: "C$", unit: 1, label: "캐나다달러" },
  },
  {
    match: ["호주", "australia", "시드니", "sydney"],
    fx: { code: "AUD", symbol: "A$", unit: 1, label: "호주달러" },
  },
];

const DEFAULT_FX: FxTarget = {
  code: "USD",
  symbol: "$",
  unit: 1,
  label: "달러",
};

/** 폴백 환율: 1 외화 = ? 원 (대략치) */
export const FALLBACK_RATES: Record<FxCurrency, number> = {
  USD: 1380,
  JPY: 9.35,
  EUR: 1500,
  GBP: 1750,
  THB: 42,
  VND: 0.054,
  TWD: 43,
  CAD: 1000,
  AUD: 900,
};

export function resolveFxTarget(
  country?: string | null,
  destination?: string | null
): FxTarget {
  const hay = `${country ?? ""} ${destination ?? ""}`.toLowerCase();
  if (!hay.trim()) return DEFAULT_FX;

  for (const row of COUNTRY_FX) {
    if (row.match.some((m) => hay.includes(m.toLowerCase()))) {
      return row.fx;
    }
  }
  return DEFAULT_FX;
}

export function formatFxRate(target: FxTarget, krwPerUnit: number): string {
  // 원화는 최소 세 자리(₩xxx) 이상 나오도록 표시 단위를 키운다.
  // 예: $1 = ₩1,380 / ¥100 = ₩937 / €1 = ₩1,734
  let unit = Math.max(1, target.unit);
  let amount = krwPerUnit * unit;

  while (amount < 100 && unit < 1_000_000) {
    unit *= 10;
    amount = krwPerUnit * unit;
  }

  const unitLabel = unit === 1 ? "" : unit.toLocaleString("ko-KR");
  const foreign = `${target.symbol}${unitLabel || "1"}`;
  const rounded = Math.round(amount).toLocaleString("ko-KR");
  return `${foreign} = ₩${rounded}`;
}

export function formatFxUpdatedAt(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "";

  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  return `${hh}:${mm} 갱신`;
}
