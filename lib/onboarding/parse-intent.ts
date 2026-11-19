/**
 * 한 줄 NL → 온보딩 폼 partial patch (순수 함수).
 * 예산(budget)은 1단계 확정이라 절대 넣지 않아요.
 */
import {
  isFlexibleScheduleValid,
  normalizeFlexibleYear,
  type DateType,
  type OnboardingForm,
  type TravelStyle,
} from "@/lib/onboarding/types";

export const PARSE_INTENT_TEXT_MAX = 200;

export type OnboardingIntentPatch = {
  destination?: string;
  origin?: string;
  dateType?: DateType;
  startDate?: string;
  endDate?: string;
  flexibleYear?: number;
  flexibleMonth?: number;
  people?: number;
  styles?: TravelStyle[];
};

const DEST_PRESETS = [
  "오사카",
  "도쿄",
  "후쿠오카",
  "방콕",
  "다낭",
  "제주",
  "파리",
  "런던",
  "뉴욕",
  "타이베이",
  "싱가포르",
  "세부",
  "괌",
  "삿포로",
  "나고야",
  "교토",
  "오키나와",
  "부산",
  "강릉",
  "여수",
] as const;

const STYLE_KEYWORDS: Array<{ style: TravelStyle; words: string[] }> = [
  { style: "food", words: ["맛집", "먹방", "미식", "음식", "카페", "맛있"] },
  { style: "shopping", words: ["쇼핑", "면세", "아울렛"] },
  { style: "sightseeing", words: ["관광", "명소", "투어", "여행"] },
  { style: "healing", words: ["힐링", "휴식", "쉬", "온천", "스파"] },
  { style: "activity", words: ["액티비티", "액티비", "체험", "다이빙", "스키"] },
  { style: "culture", words: ["문화", "박물관", "미술관", "역사"] },
  { style: "nature", words: ["자연", "산", "바다", "공원", "트레킹"] },
  { style: "hotplace", words: ["핫플", "인스타", "트렌디"] },
  { style: "shopping-mall", words: ["몰", "백화점"] },
];

const VALID_STYLES = new Set<TravelStyle>(
  STYLE_KEYWORDS.map((s) => s.style)
);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parsePeople(text: string): number | undefined {
  const m =
    /(\d{1,2})\s*(?:명|인)(?!\s*박)/.exec(text) ??
    /(?:둘이|두\s*명|2인\s*여행)/.exec(text);
  if (!m) return undefined;
  if (m[1]) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 20) return n;
    return undefined;
  }
  return 2;
}

function parseStyles(text: string): TravelStyle[] {
  const found: TravelStyle[] = [];
  for (const { style, words } of STYLE_KEYWORDS) {
    if (words.some((w) => text.includes(w)) && !found.includes(style)) {
      found.push(style);
    }
  }
  return found;
}

function parseDestination(text: string): string | undefined {
  for (const city of DEST_PRESETS) {
    if (text.includes(city)) return city;
  }
  // "도쿄로", "오사카에", "파리 여행" 등 — 조사/공백 앞 토큰
  const m = /^([가-힣A-Za-z]{2,20})(?:[으로을를에의]|[\s,]|$)/.exec(
    text.trim()
  );
  if (m?.[1] && !/^\d/.test(m[1]) && !["언제", "다음", "이번"].includes(m[1])) {
    return m[1].slice(0, 40);
  }
  return undefined;
}

function parseNightsFlexible(
  text: string,
  now: Date
): Pick<
  OnboardingIntentPatch,
  "dateType" | "flexibleYear" | "flexibleMonth" | "startDate" | "endDate"
> | null {
  const nightsM = /(\d{1,2})\s*박/.exec(text);
  const monthM = /(\d{1,2})\s*월/.exec(text);
  if (!nightsM && !monthM) return null;

  const year = now.getFullYear();
  let month = monthM ? Number(monthM[1]) : now.getMonth() + 1;
  if (month < 1 || month > 12) month = now.getMonth() + 1;

  let flexYear = year;
  if (month < now.getMonth() + 1) flexYear = year + 1;
  flexYear = normalizeFlexibleYear(flexYear);

  if (!isFlexibleScheduleValid(month, flexYear)) {
    // 과거 월이면 다음 해로
    flexYear = normalizeFlexibleYear(year + 1);
  }

  return {
    dateType: "flexible",
    flexibleYear: flexYear,
    flexibleMonth: month,
    startDate: "",
    endDate: "",
  };
}

function parseSpecificDates(
  text: string,
  now: Date
): Pick<
  OnboardingIntentPatch,
  "dateType" | "startDate" | "endDate" | "flexibleYear" | "flexibleMonth"
> | null {
  const yearHint = now.getFullYear();

  // 2026-03-01 ~ 2026-03-05 / 2026.3.1-2026.3.5
  const isoRange =
    /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s*[~\-–]\s*(\d{4})?[.\-/]?(\d{1,2})[.\-/](\d{1,2})/.exec(
      text
    );
  if (isoRange) {
    const y1 = Number(isoRange[1]);
    const m1 = Number(isoRange[2]);
    const d1 = Number(isoRange[3]);
    const y2 = isoRange[4] ? Number(isoRange[4]) : y1;
    const m2 = Number(isoRange[5]);
    const d2 = Number(isoRange[6]);
    const start = isoDate(y1, m1, d1);
    const end = isoDate(y2, m2, d2);
    if (start && end && end >= start) {
      return {
        dateType: "specific",
        startDate: start,
        endDate: end,
      };
    }
  }

  // 3/1~3/5, 3.1-3.5
  const shortRange =
    /(\d{1,2})[./](\d{1,2})\s*[~\-–]\s*(\d{1,2})[./](\d{1,2})/.exec(text);
  if (shortRange) {
    const m1 = Number(shortRange[1]);
    const d1 = Number(shortRange[2]);
    const m2 = Number(shortRange[3]);
    const d2 = Number(shortRange[4]);
    let y1 = yearHint;
    if (m1 < now.getMonth() + 1) y1 = yearHint + 1;
    let y2 = y1;
    if (m2 < m1) y2 = y1 + 1;
    const start = isoDate(y1, m1, d1);
    const end = isoDate(y2, m2, d2);
    if (start && end && end >= start) {
      return {
        dateType: "specific",
        startDate: start,
        endDate: end,
      };
    }
  }

  // 3박4일 + 3월 → flexible already handled; nights alone → flexible current/next month
  return null;
}

/** 휴리스틱만으로 partial patch 생성 */
export function parseOnboardingIntent(
  raw: string,
  now: Date = new Date()
): OnboardingIntentPatch {
  const text = raw.replace(/\s+/g, " ").trim().slice(0, PARSE_INTENT_TEXT_MAX);
  if (!text) return {};

  const patch: OnboardingIntentPatch = {};

  const dest = parseDestination(text);
  if (dest) {
    patch.destination = dest;
    patch.origin = "서울";
  }

  const people = parsePeople(text);
  if (people != null) patch.people = people;

  const styles = parseStyles(text);
  if (styles.length > 0) patch.styles = styles;

  const specific = parseSpecificDates(text, now);
  if (specific) {
    Object.assign(patch, specific);
  } else {
    const flex = parseNightsFlexible(text, now);
    if (flex) Object.assign(patch, flex);
  }

  return patch;
}

/** AI/휴리스틱 patch를 현재 폼에 합침. budget은 유지. */
export function mergeOnboardingIntent(
  form: OnboardingForm,
  patch: OnboardingIntentPatch
): OnboardingForm {
  const next: OnboardingForm = { ...form };

  if (patch.destination?.trim()) {
    next.destination = patch.destination.trim().slice(0, 40);
  }
  if (patch.origin?.trim()) {
    next.origin = patch.origin.trim().slice(0, 40);
  }
  if (
    typeof patch.people === "number" &&
    Number.isFinite(patch.people) &&
    patch.people >= 1 &&
    patch.people <= 20
  ) {
    next.people = Math.floor(patch.people);
  }
  if (Array.isArray(patch.styles)) {
    const styles = patch.styles.filter((s) => VALID_STYLES.has(s));
    if (styles.length > 0) next.styles = [...new Set(styles)];
  }

  if (patch.dateType === "specific") {
    if (patch.startDate && patch.endDate && patch.endDate >= patch.startDate) {
      next.dateType = "specific";
      next.startDate = patch.startDate;
      next.endDate = patch.endDate;
    }
  } else if (patch.dateType === "flexible") {
    const month = patch.flexibleMonth ?? next.flexibleMonth;
    const year = normalizeFlexibleYear(patch.flexibleYear ?? next.flexibleYear);
    if (month >= 1 && month <= 12) {
      next.dateType = "flexible";
      next.flexibleMonth = month;
      next.flexibleYear = year;
      next.startDate = "";
      next.endDate = "";
    }
  }

  return next;
}

/** 서버/클라이언트 공통: 빈 patch 여부 */
export function intentPatchIsEmpty(patch: OnboardingIntentPatch): boolean {
  return (
    !patch.destination &&
    !patch.origin &&
    patch.people == null &&
    (!patch.styles || patch.styles.length === 0) &&
    !patch.dateType
  );
}

/** local 위에 AI가 채운 필드만 덮어씀 */
export function overlayIntentPatch(
  local: OnboardingIntentPatch,
  ai: OnboardingIntentPatch
): OnboardingIntentPatch {
  const out: OnboardingIntentPatch = { ...local };
  if (ai.destination?.trim()) out.destination = ai.destination.trim();
  if (ai.origin?.trim()) out.origin = ai.origin.trim();
  if (typeof ai.people === "number") out.people = ai.people;
  if (ai.styles && ai.styles.length > 0) out.styles = ai.styles;
  if (ai.dateType === "specific" && ai.startDate && ai.endDate) {
    out.dateType = "specific";
    out.startDate = ai.startDate;
    out.endDate = ai.endDate;
  } else if (ai.dateType === "flexible") {
    out.dateType = "flexible";
    if (typeof ai.flexibleMonth === "number") {
      out.flexibleMonth = ai.flexibleMonth;
    }
    if (typeof ai.flexibleYear === "number") {
      out.flexibleYear = ai.flexibleYear;
    }
    out.startDate = "";
    out.endDate = "";
  }
  return out;
}
