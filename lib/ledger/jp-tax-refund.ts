/**
 * 일본 면세(선결제 후 환급) 안내용 순수 함수.
 * 환급액은 계산하지 않아요.
 *
 * 공식 근거 (확인일 2026-11-02):
 * https://www.customs.go.jp/kaigairyoko/taxrefund.htm
 * - 2026-11-01 이후 구매: 세금 포함 구매 → 출국 시 소비세 상당액 환급
 * - 1점포·1일 합계 5,000엔 이상(세 제외), 90일 이내 수속
 */

/** 세 제외 합계 기준 (엔). VERIFY: 공식 안내 2026-11-02 */
export const THRESHOLD_JPY_EXCL_TAX = 5000;
/** 구매일부터 수속 기한(일). VERIFY: 공식 안내 2026-11-02 — 당일 포함 여부는 미확인 → UI에 '약' */
export const WINDOW_DAYS = 90;
/** 신제도 적용 시작일 (로컬 구매일 기준). */
export const EFFECTIVE_FROM = "2026-11-01";

export const JP_TAX_REFUND_SOURCE_URL =
  "https://www.customs.go.jp/kaigairyoko/taxrefund.htm";
export const JP_TAX_REFUND_VERIFIED_ON = "2026-11-02";

export type TaxFreeExpense = {
  id: string;
  merchant?: string | null;
  label?: string | null;
  placeId?: string | null;
  spentOn?: string | null;
  currency: string;
  amount: number;
  category?: string | null;
  taxFree?: boolean;
  /** 원통화 세별도 금액. 없으면 needs_amount */
  taxExclAmount?: number | null;
};

export type StoreDayStatus =
  | "eligible"
  | "below_threshold"
  | "needs_amount"
  | "legacy"
  | "consumable_warning";

export type StoreDayGroup = {
  key: string;
  storeLabel: string;
  placeId: string | null;
  spentOn: string;
  expenseIds: string[];
  taxExclSum: number | null;
  shortfall: number | null;
  status: StoreDayStatus;
  /** 대략 수속 기한 (구매일+90일). 정확한 기한은 공식 안내 확인 */
  deadlineApprox: string;
};

/** 식음료 등 일본 내 소비 시 대상 제외 안내. 화장품은 카테고리만으로는 구분 어려워 식비만. */
const CONSUMABLE = new Set(["식비"]);

function normalizeStore(e: TaxFreeExpense): { key: string; label: string; placeId: string | null } {
  if (e.placeId) {
    return {
      key: `place:${e.placeId}`,
      label: (e.merchant || e.label || "점포").trim() || "점포",
      placeId: e.placeId,
    };
  }
  const label = (e.merchant || e.label || "점포").trim() || "점포";
  return {
    key: `name:${label.toLowerCase().replace(/\s+/g, "")}`,
    label,
    placeId: null,
  };
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * 점포×날짜로 묶어 상태만 판정. 환급액 필드 없음.
 */
export function groupStoreDays(
  expenses: readonly TaxFreeExpense[]
): StoreDayGroup[] {
  type Acc = {
    storeLabel: string;
    placeId: string | null;
    spentOn: string;
    expenseIds: string[];
    taxExclParts: Array<number | null>;
    categories: string[];
  };
  const map = new Map<string, Acc>();

  for (const e of expenses) {
    if (!e.taxFree) continue;
    if ((e.currency || "").toUpperCase() !== "JPY") continue;
    const spentOn = e.spentOn?.slice(0, 10);
    if (!spentOn || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) continue;
    const store = normalizeStore(e);
    const key = `${store.key}|${spentOn}`;
    const acc =
      map.get(key) ??
      ({
        storeLabel: store.label,
        placeId: store.placeId,
        spentOn,
        expenseIds: [],
        taxExclParts: [],
        categories: [],
      } satisfies Acc);
    acc.expenseIds.push(e.id);
    acc.taxExclParts.push(
      typeof e.taxExclAmount === "number" && e.taxExclAmount > 0
        ? e.taxExclAmount
        : null
    );
    if (e.category) acc.categories.push(e.category);
    map.set(key, acc);
  }

  const out: StoreDayGroup[] = [];
  for (const [key, acc] of map) {
    const deadlineApprox = addDaysYmd(acc.spentOn, WINDOW_DAYS);
    let status: StoreDayStatus;
    let taxExclSum: number | null = null;
    let shortfall: number | null = null;

    if (acc.spentOn < EFFECTIVE_FROM) {
      status = "legacy";
    } else if (acc.categories.some((c) => CONSUMABLE.has(c))) {
      // 식음료·화장품 등은 일본 내 소비 시 대상 아님 — 경고
      status = "consumable_warning";
      const parts = acc.taxExclParts;
      if (parts.every((p) => p != null)) {
        taxExclSum = parts.reduce((s, p) => s + (p as number), 0);
      }
    } else if (acc.taxExclParts.some((p) => p == null)) {
      status = "needs_amount";
    } else {
      const sum = acc.taxExclParts.reduce<number>(
        (s, p) => s + (p ?? 0),
        0
      );
      taxExclSum = sum;
      if (sum >= THRESHOLD_JPY_EXCL_TAX) {
        status = "eligible";
      } else {
        status = "below_threshold";
        shortfall = THRESHOLD_JPY_EXCL_TAX - sum;
      }
    }

    out.push({
      key,
      storeLabel: acc.storeLabel,
      placeId: acc.placeId,
      spentOn: acc.spentOn,
      expenseIds: acc.expenseIds,
      taxExclSum,
      shortfall,
      status,
      deadlineApprox,
    });
  }

  return out.sort(
    (a, b) =>
      a.spentOn.localeCompare(b.spentOn) ||
      a.storeLabel.localeCompare(b.storeLabel)
  );
}

export const JP_TAX_REFUND_DISCLAIMER =
  "참고용이에요. 환급액은 계산하지 않아요. 정확한 기한·조건은 공식 안내를 확인해 주세요.";
