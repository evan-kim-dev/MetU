/** 테스트 전용 합성 데이터 (실제 이름·금액 아님). 앱 코드에서 import 하지 않아요. */
import type { AutomationStatusEvent } from "@/lib/hooks/useAutomationStatus";
import type { SettlementSnapshot } from "@/lib/ledger/supabase";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import type { Trip } from "@/lib/trips/types";

export function makeTrip(over: Partial<Trip> & { id: string }): Trip {
  return {
    destination: "도쿄",
    country: "일본",
    origin: "서울",
    dateRange: "7월 20일 - 7월 24일",
    dDay: 0,
    budget: 1_000_000,
    spent: 0,
    people: 2,
    styles: [],
    imageUrl: "",
    expenses: [],
    status: "upcoming",
    ...over,
  };
}

export const TOKYO = makeTrip({
  id: "t-tokyo",
  destination: "도쿄",
  status: "ongoing",
  startDate: "2026-07-20",
  endDate: "2026-07-24",
});

export const OSAKA = makeTrip({
  id: "t-osaka",
  destination: "오사카",
  dateRange: "9월 10일 - 9월 13일",
  status: "upcoming",
  startDate: "2026-09-10",
  endDate: "2026-09-13",
});

export const MEMBERS: TripMember[] = [
  { id: "m1", tripId: "t-tokyo", displayName: "가나", isOwner: true, userId: "u1" },
  { id: "m2", tripId: "t-tokyo", displayName: "다라", isOwner: false, userId: "u2" },
];

export function makeExpense(
  over: Partial<LedgerExpenseRow> & { id: string }
): LedgerExpenseRow {
  return {
    tripId: "t-tokyo",
    paidBy: "m1",
    label: "점심",
    merchant: "점심",
    category: "식비",
    amount: 10_000,
    currency: "KRW",
    fxRateToKrw: 1,
    krwAmount: 10_000,
    spentOn: "2026-07-21",
    splitType: "equal",
    shares: {},
    ...over,
  };
}

function jpy(id: string, merchant: string, amount: number, krw: number) {
  return makeExpense({
    id,
    label: merchant,
    merchant,
    amount,
    currency: "JPY",
    fxRateToKrw: 9.1,
    fxRate: 9.1,
    fxRateDate: "2026-07-22",
    fxSource: "auto_daily",
    krwAmount: krw,
    spentOn: "2026-07-22",
  });
}

/** listExpenses 순서(생성 오래된 순): KRW 3 + JPY 3 */
export const EXPENSES: LedgerExpenseRow[] = [
  makeExpense({ id: "e1", merchant: "공항 커피", label: "공항 커피", krwAmount: 5_000, amount: 5_000 }),
  makeExpense({ id: "e2", merchant: "지하철", label: "지하철", krwAmount: 3_000, amount: 3_000 }),
  makeExpense({ id: "e3", merchant: "편의점", label: "편의점", krwAmount: 7_000, amount: 7_000 }),
  jpy("e4", "라멘집", 1_000, 9_100),
  jpy("e5", "기념품", 2_000, 18_200),
  jpy("e6", "야키토리", 3_000, 27_300),
];

export const EXPENSES_TOTAL_KRW = 5_000 + 3_000 + 7_000 + 9_100 + 18_200 + 27_300;

export const SETTLEMENT_OPEN: SettlementSnapshot = {
  id: "s1",
  version: 1,
  status: "open",
  origin: "manual",
  basisHash: "h",
  shareToken: null,
  transfers: [
    { id: "x1", from: "m2", to: "m1", krw: 12_000, status: "pending" },
    { id: "x2", from: "m2", to: "m1", krw: 8_000, status: "pending" },
  ],
};

export function makeEvent(
  over: Partial<AutomationStatusEvent> & { id: string }
): AutomationStatusEvent {
  return {
    status: "unassigned",
    createdAt: "2026-07-21T03:00:00Z",
    source: "sms",
    tripId: null,
    textPreview: "",
    error: null,
    reason: "outside_window",
    isTest: false,
    preview: { amount: 4_500, currency: "KRW", merchant: "스타카페", confidence: 0.9, kind: "approval" },
    ...over,
  };
}
