import { minorUnits } from "@/lib/ledger/money";

export interface SmsContext {
  today: string;
  tripStart?: string | null;
  tripEnd?: string | null;
}

export interface ParsedSms {
  ok: boolean;
  confidence: number;
  issuer:
    | "shinhan"
    | "samsung"
    | "hyundai"
    | "hana"
    | "woori"
    | "kb"
    | "unknown";
  kind: "approval" | "cancel" | "unknown";
  domestic: boolean;
  merchant: string | null;
  currency: string | null;
  amount: number | null;
  countryCode: string | null;
  paidAt: string | null;
  spentOn: string | null;
  timeIsEstimated: boolean;
  cardHint: string | null;
  warnings: string[];
}

const KOREAN_CCY: Record<string, string> = {
  엔: "JPY",
  유로: "EUR",
  위안: "CNY",
  바트: "THB",
  동: "VND",
  파운드: "GBP",
  원: "KRW",
};

const DOLLAR_BY_COUNTRY: Record<string, string> = {
  US: "USD",
  HK: "HKD",
  SG: "SGD",
  AU: "AUD",
  CA: "CAD",
  NZ: "NZD",
  TW: "TWD",
};

function empty(partial: Partial<ParsedSms> = {}): ParsedSms {
  return {
    ok: false,
    confidence: 0,
    issuer: "unknown",
    kind: "unknown",
    domestic: false,
    merchant: null,
    currency: null,
    amount: null,
    countryCode: null,
    paidAt: null,
    spentOn: null,
    timeIsEstimated: true,
    cardHint: null,
    warnings: [],
    ...partial,
  };
}

export function splitSmsBatch(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  const byMarker = raw
    .split(/(?=\[Web발신\])/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byMarker.length > 1) return byMarker;
  return raw
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function redactSms(text: string): string {
  let out = text;
  // masked names like 홍*동, 이*름
  out = out.replace(/[가-힣]\*[가-힣]+/g, "[가림]");
  // card last4 / masked pan fragments
  out = out.replace(/\*{2,}\d{0,4}|\(\*{2,}\)|\(\d{0,2}\*{2,}\d{0,2}\)/g, "[가림]");
  out = out.replace(/(신한|삼성|현대|하나|우리|KB|국민)\(?\d{2,4}\)?/gi, "$1[가림]");
  // cumulative balance
  out = out.replace(/누적\s*[\d,]+(?:\.\d+)?\s*원?/g, "누적[가림]");
  // phone numbers
  out = out.replace(/01[016789]-?\d{3,4}-?\d{4}/g, "[가림]");
  return out;
}

export function inferYear(
  month: number,
  day: number,
  ctx: SmsContext
): number {
  const [ty, tm, td] = ctx.today.split("-").map(Number);
  const todayY = ty!;

  const inRange = (y: number) => {
    const iso = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (ctx.tripStart && ctx.tripEnd) {
      return iso >= ctx.tripStart && iso <= ctx.tripEnd;
    }
    if (ctx.tripStart && !ctx.tripEnd) {
      return iso >= ctx.tripStart;
    }
    return false;
  };

  if (ctx.tripStart || ctx.tripEnd) {
    for (const y of [todayY - 1, todayY, todayY + 1]) {
      if (inRange(y)) return y;
    }
  }

  // nearest past relative to today; allow up to +2 days future
  const candidates = [todayY - 1, todayY, todayY + 1];
  let best = todayY;
  let bestDiff = Infinity;
  for (const y of candidates) {
    const iso = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const t = Date.parse(`${iso}T12:00:00+09:00`);
    const todayT = Date.parse(`${ctx.today}T12:00:00+09:00`);
    if (Number.isNaN(t) || Number.isNaN(todayT)) continue;
    const diffDays = (t - todayT) / 86_400_000;
    if (diffDays > 2) continue;
    const score = Math.abs(diffDays);
    // prefer past when tie
    const prefer = diffDays <= 0 ? score : score + 0.01;
    if (prefer < bestDiff) {
      bestDiff = prefer;
      best = y;
    }
  }
  return best;
}

function detectIssuer(text: string): ParsedSms["issuer"] {
  if (/신한/.test(text)) return "shinhan";
  if (/삼성/.test(text)) return "samsung";
  if (/현대/.test(text)) return "hyundai";
  if (/하나/.test(text)) return "hana";
  if (/우리/.test(text)) return "woori";
  if (/KB|국민/.test(text)) return "kb";
  return "unknown";
}

function parseAmountToken(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mapCurrency(
  token: string | null,
  country: string | null,
  warnings: string[]
): string | null {
  if (!token) return null;
  const t = token.trim();
  const upper = t.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  if (t === "달러" || upper === "DOLLAR") {
    if (country && DOLLAR_BY_COUNTRY[country]) {
      return DOLLAR_BY_COUNTRY[country]!;
    }
    warnings.push("달러 종류 불명");
    return "USD";
  }
  return KOREAN_CCY[t] ?? null;
}

function extractCountry(text: string): string | null {
  const m = text.match(/\(([A-Z]{2})\)/);
  return m?.[1] ?? null;
}

function extractDateTime(
  text: string,
  ctx: SmsContext,
  warnings: string[]
): {
  paidAt: string | null;
  spentOn: string | null;
  timeIsEstimated: boolean;
} {
  // MM/DD HH:MM or M/D HH:MM
  const m = text.match(
    /(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/
  );
  if (!m) {
    const dOnly = text.match(/(\d{1,2})\/(\d{1,2})/);
    if (!dOnly) {
      return { paidAt: null, spentOn: null, timeIsEstimated: true };
    }
    const month = Number(dOnly[1]);
    const day = Number(dOnly[2]);
    const year = inferYear(month, day, ctx);
    const spentOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    warnings.push("시각 없음");
    return {
      paidAt: `${spentOn}T12:00:00+09:00`,
      spentOn,
      timeIsEstimated: true,
    };
  }
  const month = Number(m[1]);
  const day = Number(m[2]);
  const hh = String(m[3]).padStart(2, "0");
  const mm = String(m[4]).padStart(2, "0");
  const year = inferYear(month, day, ctx);
  const spentOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const weakYear =
    !ctx.tripStart &&
    !ctx.tripEnd &&
    (month === 12 || month === 1);
  return {
    paidAt: `${spentOn}T${hh}:${mm}:00+09:00`,
    spentOn,
    timeIsEstimated: weakYear,
  };
}

function cleanMerchant(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let m = raw.trim();
  m = m.replace(/\([A-Z]{2}\)/g, " ");
  m = m.replace(/누적[\d,]+(?:\.\d+)?원?/g, " ");
  m = m.replace(/일시불|할부\d*개월?/g, " ");
  m = m.replace(/\s+/g, " ").trim();
  return m || null;
}

function cardHintFrom(text: string, issuer: ParsedSms["issuer"]): string | null {
  const digits = text.match(/(?:신한|삼성|현대|하나|우리)\(?(\d{2,4})\)?/);
  if (digits) {
    const name =
      issuer === "unknown"
        ? "카드"
        : issuer === "kb"
          ? "KB"
          : issuer === "shinhan"
            ? "신한"
            : issuer === "samsung"
              ? "삼성"
              : issuer === "hyundai"
                ? "현대"
                : issuer === "hana"
                  ? "하나"
                  : "우리";
    return `${name}`;
  }
  if (issuer === "unknown") return null;
  return issuer === "kb"
    ? "KB"
    : issuer === "shinhan"
      ? "신한"
      : issuer === "samsung"
        ? "삼성"
        : issuer === "hyundai"
          ? "현대"
          : issuer === "hana"
            ? "하나"
            : "우리";
}

type Extracted = {
  amount: number | null;
  currencyToken: string | null;
  merchant: string | null;
  domestic: boolean;
};

/** VERIFY: 신한 해외/체크 해외 예시 */
function tryShinhan(text: string): Extracted | null {
  // 해외: 금액 + 통화단어 + (CC) + merchant + date OR date interleaved
  let m = text.match(
    /해외승인[^\d]*([\d,.]+)\s*(달러|엔|유로|위안|바트|동|파운드|USD|JPY|EUR|CNY|THB|VND|GBP)\s*(?:\(([A-Z]{2})\))?\s*(?:(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\s*)?(.+?)(?:\s*누적|$)/
  );
  if (m) {
    return {
      amount: parseAmountToken(m[1]!),
      currencyToken: m[2]!,
      merchant: cleanMerchant(
        [m[5], m[4]].filter(Boolean).join(" ").replace(/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}/, "")
      ),
      domestic: false,
    };
  }
  // 체크: date then amount 엔 (JP)MERCHANT
  m = text.match(
    /해외승인[^\d]*(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\s+([\d,.]+)\s*(엔|달러|USD|JPY)\s*(?:\(([A-Z]{2})\))?([^\n누적]+)/
  );
  if (m) {
    return {
      amount: parseAmountToken(m[2]!),
      currencyToken: m[3]!,
      merchant: cleanMerchant(m[5]),
      domestic: false,
    };
  }
  // demo: 45,000엔 (JP)HOTEL ... date
  m = text.match(
    /해외승인[^\d]*([\d,.]+)\s*(엔|달러|USD|JPY)\s*(?:\(([A-Z]{2})\))?([A-Za-z0-9 ._-]+?)(?:\s+(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}))/
  );
  if (m) {
    return {
      amount: parseAmountToken(m[1]!),
      currencyToken: m[2]!,
      merchant: cleanMerchant(m[4]),
      domestic: false,
    };
  }
  return null;
}

/** VERIFY: 삼성 해외/국내 */
function trySamsung(text: string): Extracted | null {
  let m = text.match(
    /해외승인[^\n]*?\b([A-Z]{3})\s+([\d,.]+)\s+(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\s+(.+)$/m
  );
  if (m) {
    return {
      amount: parseAmountToken(m[2]!),
      currencyToken: m[1]!,
      merchant: cleanMerchant(m[4]),
      domestic: false,
    };
  }
  m = text.match(
    /승인[^\d]*([\d,]+)원[^\d]*(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\s+(.+?)(?:\s*누적|$)/
  );
  if (m) {
    return {
      amount: parseAmountToken(m[1]!),
      currencyToken: "원",
      merchant: cleanMerchant(m[3]),
      domestic: true,
    };
  }
  return null;
}

/** VERIFY: 현대 해외/취소 */
function tryHyundai(text: string): Extracted | null {
  let m = text.match(
    /해외승인[^\n]*?(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\s+([A-Z]{3})\s+([\d,.]+)\s+(.+)$/m
  );
  if (m) {
    return {
      amount: parseAmountToken(m[3]!),
      currencyToken: m[2]!,
      merchant: cleanMerchant(m[4]),
      domestic: false,
    };
  }
  return null;
}

/** VERIFY: 하나/우리 국내 */
function tryDomesticKrw(text: string): Extracted | null {
  const m = text.match(
    /승인[^\d]*([\d,]+)원[^\d]*(?:\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\s+(.+?)(?:\s*누적|$)/
  );
  if (!m) return null;
  return {
    amount: parseAmountToken(m[1]!),
    currencyToken: "원",
    merchant: cleanMerchant(m[2]),
    domestic: true,
  };
}

export function parseCardSms(text: string, ctx: SmsContext): ParsedSms {
  const raw = text.trim();
  if (!raw) return empty();

  const warnings: string[] = [];
  const issuer = detectIssuer(raw);

  if (/취소/.test(raw)) {
    const dt = extractDateTime(raw, ctx, warnings);
    const amt = raw.match(/([\d,]+)원/);
    return {
      ok: true,
      confidence: 0.9,
      issuer,
      kind: "cancel",
      domestic: true,
      merchant: cleanMerchant(
        raw.replace(/\[.*?\]/g, " ").replace(/취소.*$/, "").trim()
      ),
      currency: "KRW",
      amount: amt ? parseAmountToken(amt[1]!) : null,
      countryCode: null,
      paidAt: dt.paidAt,
      spentOn: dt.spentOn,
      timeIsEstimated: dt.timeIsEstimated,
      cardHint: cardHintFrom(raw, issuer),
      warnings,
    };
  }

  if (!/승인|해외승인/.test(raw)) {
    return empty({ issuer, warnings: ["승인 키워드 없음"] });
  }

  let extracted: Extracted | null = null;
  if (issuer === "shinhan") extracted = tryShinhan(raw);
  else if (issuer === "samsung") extracted = trySamsung(raw);
  else if (issuer === "hyundai") extracted = tryHyundai(raw);
  if (!extracted) extracted = tryDomesticKrw(raw);
  if (!extracted && issuer === "shinhan") extracted = tryShinhan(raw);
  if (!extracted) {
    // generic overseas ISO
    const g = raw.match(
      /\b([A-Z]{3})\s+([\d,.]+)|([\d,.]+)\s*(달러|엔|원|USD|JPY)/
    );
    if (g) {
      extracted = {
        amount: parseAmountToken(g[2] || g[3] || ""),
        currencyToken: g[1] || g[4] || null,
        merchant: null,
        domestic: (g[4] === "원"),
      };
      warnings.push("일반 패턴");
    }
  }

  if (!extracted || extracted.amount == null) {
    return empty({ issuer, kind: "unknown", warnings: ["금액 파싱 실패"] });
  }

  const countryCode = extractCountry(raw);
  const currency = mapCurrency(
    extracted.currencyToken,
    countryCode,
    warnings
  );
  const dt = extractDateTime(raw, ctx, warnings);

  let confidence = 0.5;
  if (extracted.amount != null) confidence += 0.2;
  if (currency) confidence += 0.15;
  if (dt.spentOn) confidence += 0.15;
  if (extracted.merchant) confidence += 0.1;
  if (warnings.includes("달러 종류 불명")) confidence -= 0.15;
  if (warnings.includes("일반 패턴")) confidence -= 0.1;
  confidence = Math.max(0, Math.min(1, confidence));

  if (currency) {
    const minors = minorUnits(currency);
    const frac = String(extracted.amount).split(".")[1];
    if (minors === 0 && frac && Number(frac) !== 0) {
      warnings.push("통화 소수 자릿수 이상");
      confidence -= 0.05;
    }
  }

  const ok =
    extracted.amount != null && currency != null && dt.spentOn != null;

  return {
    ok,
    confidence: ok ? Math.max(confidence, 0.55) : confidence,
    issuer,
    kind: "approval",
    domestic: extracted.domestic || currency === "KRW",
    merchant: extracted.merchant,
    currency,
    amount: extracted.amount,
    countryCode,
    paidAt: dt.paidAt,
    spentOn: dt.spentOn,
    timeIsEstimated: dt.timeIsEstimated,
    cardHint: cardHintFrom(raw, issuer),
    warnings,
  };
}
