import type { CodefBenefit, CodefCard } from "./codef-schema";
import type {
  BenefitScope,
  CardPerformance,
  CardSnapshot,
  ParsedBenefit,
} from "./types";

/**
 * CODEF 혜택 문장(예: "[청구할인]해외 가맹점 2% 청구할인, 월 최대 2만원")을
 * 규칙으로 읽어 할인율·정액·월 한도·적용 범위로 바꿔요.
 * AI 없이 정규식만 써요. 못 읽은 항목은 needs-review 로 남겨 사람이 확인해요.
 */

const SCOPE_KEYWORDS: Array<{ scope: BenefitScope; re: RegExp }> = [
  { scope: "overseas", re: /해외|해외가맹점|해외결제|해외이용|외화|overseas/i },
  { scope: "flight", re: /항공|항공권|공항|라운지|airline|flight/i },
  { scope: "lodging", re: /숙박|호텔|숙소|리조트|에어비앤비|아고다|부킹|트립닷컴|hotel/i },
  { scope: "food", re: /음식|외식|레스토랑|식당|음식점|카페|커피|스타벅스|베이커리|음료|배달/i },
  { scope: "transport", re: /교통|택시|버스|지하철|철도|기차|대중교통|주유|렌터카|모빌리티/i },
  { scope: "shopping", re: /쇼핑|면세|백화점|마트|편의점|아울렛|온라인몰/i },
];

function toInt(v: string | null | undefined): number | null {
  if (v == null) return null;
  const digits = String(v).replace(/[^0-9-]/g, "");
  if (!digits || digits === "-") return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** "2만원", "20,000원", "1.5만 원" → 원 단위 정수 */
function parseWon(numText: string, unitText: string | undefined): number | null {
  const n = Number(numText.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const isMan = unitText ? /만/.test(unitText) : false;
  return Math.round(isMan ? n * 10_000 : n);
}

export function parseBenefitText(input: {
  type?: string | null;
  name?: string | null;
  businessTypes?: string | null;
  details?: Array<{
    name?: string | null;
    conditions?: string | null;
    businessTypes?: string | null;
  }>;
}): ParsedBenefit {
  const type = (input.type ?? "").trim();
  const name = (input.name ?? "").trim();
  const detailText = (input.details ?? [])
    .map((d) => [d.name, d.conditions, d.businessTypes].filter(Boolean).join(" "))
    .join(" ");
  const all = [type, name, input.businessTypes ?? "", detailText].join(" ");

  // 퍼센트: "10%", "2.5 %"
  const pct = all.match(/(\d+(?:\.\d+)?)\s*%/);
  const rate = pct ? Number(pct[1]) / 100 : null;

  // 월 한도: "월 최대 2만원", "월 한도 20,000원", "월 2만원까지"
  const cap =
    all.match(/월\s*(?:최대|한도)?\s*([\d,.]+)\s*(만\s*원|만원|원)/) ??
    all.match(/한도\s*([\d,.]+)\s*(만\s*원|만원|원)/);
  const monthlyCapKrw = cap ? parseWon(cap[1]!, cap[2]) : null;

  // 건당 정액: "5,000원 할인", "3천원 캐시백" (한도 문구와 겹치지 않게 앞뒤 확인)
  let flatKrw: number | null = null;
  if (rate == null) {
    const flat = all.match(/([\d,.]+)\s*(만\s*원|만원|천\s*원|천원|원)\s*(?:청구)?\s*(?:할인|캐시백|적립)/);
    if (flat) {
      const unit = flat[2] ?? "";
      const base = Number(flat[1]!.replace(/,/g, ""));
      flatKrw = Number.isFinite(base)
        ? Math.round(/만/.test(unit) ? base * 10_000 : /천/.test(unit) ? base * 1_000 : base)
        : null;
      if (flatKrw != null && monthlyCapKrw != null && flatKrw === monthlyCapKrw) {
        flatKrw = null; // 한도 문구를 정액으로 잘못 읽은 경우
      }
    }
  }

  const kind: ParsedBenefit["kind"] = /적립|포인트|캐시백|마일리지/.test(all)
    ? "reward"
    : "discount";

  const scopes: BenefitScope[] = [];
  for (const { scope, re } of SCOPE_KEYWORDS) {
    if (re.test(all) && !scopes.includes(scope)) scopes.push(scope);
  }

  const hasAmount = rate != null || flatKrw != null;
  return {
    type: type || (kind === "reward" ? "적립" : "할인"),
    name: name || type || "혜택",
    rate,
    flatKrw,
    monthlyCapKrw,
    kind,
    scopes,
    status: hasAmount && scopes.length > 0 ? "parsed" : "needs-review",
  };
}

function parsePerformance(benefits: CodefBenefit[]): CardPerformance {
  // 실적은 혜택마다 같은 값이 반복되는 경우가 많아요 → 첫 유효값을 써요.
  for (const b of benefits) {
    for (const p of b.resCardPerformanceList ?? []) {
      const current = toInt(p.resCurrentUseAmt);
      const required = toInt(p.resRequiredPerformanceAmt);
      const standard = toInt(p.resStandardUseAmt);
      if (current == null && required == null && standard == null) continue;
      const yn = (p.resMeetPerformanceYN ?? "").trim();
      return {
        currentKrw: current,
        requiredKrw: required,
        standardKrw: standard,
        met: yn === "1" ? true : yn === "0" ? false : null,
        periodStart: p.commStartDate?.trim() || null,
        periodEnd: p.commEndDate?.trim() || null,
      };
    }
  }
  return {
    currentKrw: null,
    requiredKrw: null,
    standardKrw: null,
    met: null,
    periodStart: null,
    periodEnd: null,
  };
}

function last4Of(cardNo: string | null | undefined): string | null {
  const digits = (cardNo ?? "").replace(/[^0-9]/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/** CODEF 카드 응답 → 화면·계획용 스냅샷. 카드번호는 끝 4자리만 남겨요. */
export function normalizeCodefCard(card: CodefCard, index = 0): CardSnapshot {
  const benefits = card.resCardBenefitList ?? [];
  const last4 = last4Of(card.resCardNo);
  return {
    id: `${last4 ?? "card"}-${index}`,
    name: card.resCardName.trim(),
    company: card.resCardCompany?.trim() || null,
    last4,
    performance: parsePerformance(benefits),
    benefits: benefits.map((b) =>
      parseBenefitText({
        type: b.resType,
        name: b.resCardBenefitName,
        businessTypes: b.resBusinessTypes,
        details: (b.resDetailList ?? []).map((d) => ({
          name: d.resCardBenefitName,
          conditions: d.resPerformanceConditions,
          businessTypes: d.resBusinessTypes,
        })),
      })
    ),
  };
}
