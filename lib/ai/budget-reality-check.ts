import { getBudgetBand } from "@/lib/rag/budgetBands";

const EUROPE_KEYWORDS = [
  "유럽",
  "파리",
  "로마",
  "런던",
  "프라하",
  "부다페스트",
  "바르셀로나",
  "밀라노",
  "암스테르담",
  "베를린",
  "비엔나",
  "취리히",
  "마드리드",
  "리스본",
];

const LONG_HAUL_KEYWORDS = [
  "뉴욕",
  "new york",
  "시드니",
  "sydney",
  "로스앤젤레스",
  "los angeles",
  "LA",
  "하와이",
  "호주",
  "미국",
  "캐나다",
  "몬트리올",
];

const DOMESTIC_KEYWORDS = ["제주", "부산", "서울", "국내", "대한민국"];

/** 서울 기준 대략 거리(km) */
const DISTANCE_KM_FROM_SEOUL: Record<string, number> = {
  파리: 8960,
  로마: 8890,
  런던: 8860,
  프라하: 8250,
  바르셀로나: 9650,
  뉴욕: 11050,
  시드니: 8370,
  도쿄: 1160,
  오사카: 830,
  방콕: 3670,
  다낭: 2990,
  싱가포르: 4660,
  홍콩: 2090,
  타이베이: 1470,
  발리: 5270,
  후쿠오카: 540,
};

export interface BudgetRealityInput {
  perPerson: number;
  totalBudget: number;
  people: number;
  destination: string;
  country: string;
  allowedRegions: string[];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function mentionsAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

function isInAllowedRegions(
  destination: string,
  country: string,
  allowedRegions: string[]
): boolean {
  const text = normalizeText(`${destination} ${country}`);
  return allowedRegions.some((region) => {
    const key = normalizeText(region);
    return text.includes(key) || key.includes(normalizeText(destination));
  });
}

function estimateDistanceKm(destination: string, country: string): number {
  const text = `${destination} ${country}`;
  for (const [city, km] of Object.entries(DISTANCE_KM_FROM_SEOUL)) {
    if (text.includes(city)) return km;
  }
  if (mentionsAny(text, EUROPE_KEYWORDS)) return 9000;
  if (mentionsAny(text, LONG_HAUL_KEYWORDS)) return 10000;
  return 3500;
}

function formatBudgetLabel(amount: number): string {
  if (amount >= 10_000) {
    return `${Math.round(amount / 10_000).toLocaleString("ko-KR")}만원`;
  }
  return `${amount.toLocaleString("ko-KR")}원`;
}

function pickTemplateIndex(seed: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % size;
  }
  return hash;
}

export function isUnrealisticBudgetDestination(
  input: BudgetRealityInput
): boolean {
  const { perPerson, destination, country, allowedRegions } = input;
  const text = normalizeText(`${destination} ${country}`);

  if (perPerson < 300_000 && !mentionsAny(text, DOMESTIC_KEYWORDS)) {
    return true;
  }

  if (mentionsAny(text, EUROPE_KEYWORDS) && perPerson < 2_500_000) {
    return true;
  }

  if (mentionsAny(text, LONG_HAUL_KEYWORDS) && perPerson < 4_000_000) {
    return true;
  }

  if (!isInAllowedRegions(destination, country, allowedRegions)) {
    if (mentionsAny(text, [...EUROPE_KEYWORDS, ...LONG_HAUL_KEYWORDS])) {
      return true;
    }
    if (perPerson < 900_000 && !mentionsAny(text, DOMESTIC_KEYWORDS)) {
      return true;
    }
  }

  return false;
}

export function buildBudgetFactBomb(input: BudgetRealityInput): string | null {
  if (!isUnrealisticBudgetDestination(input)) return null;

  const {
    perPerson,
    totalBudget,
    people,
    destination,
    country,
    allowedRegions,
  } = input;
  const label = country ? `${destination}, ${country}` : destination;
  const perLabel = formatBudgetLabel(perPerson);
  const totalLabel = formatBudgetLabel(totalBudget);
  const km = estimateDistanceKm(destination, country);
  const alt = allowedRegions.slice(0, 3).join("·") || "제주·부산·후쿠오카";
  const band = getBudgetBand(perPerson);
  const flightOnlyHint =
    perPerson < 1_000_000
      ? "항공값만 해도 예산이 증발할 가능성 99%"
      : "항공+숙소만 해도 예산이 빠듯해요";

  const templates = [
    `1인당 ${perLabel}으로 ${label}? 말 되는 소리 좀 해봐요. 서울에서 약 ${km.toLocaleString("ko-KR")}km니까 수영 ${km.toLocaleString("ko-KR")}번 하면 도착이에요 🏊`,
    `${label} 가고 싶다고요? 그건 제가 아는 ${formatBudgetLabel(perPerson)} 여행이 아니에요. 현실은 ${alt} 쪽입니다.`,
    `총 ${totalLabel}(${people}명)으로 ${label}는 ${flightOnlyHint}. 아니면 돼지저금통부터 털어보실래요? 🐷`,
    `예산 ${perLabel}에 ${label}는 밈으로도 빡세요. "현실 좀 봐" 버전 추천지는 ${alt}예요.`,
    `${label} 티켓은 예산한테 먼저 사과받으세요. 이 정도면 ${band.nights} ${alt}이 정답입니다.`,
    `${destination} 가려면 지갑부터 유럽 가야 해요. 지금 예산으론 ${alt}나 가보죠. (진심)`,
  ];

  const seed = `${destination}-${perPerson}-${totalBudget}`;
  return templates[pickTemplateIndex(seed, templates.length)];
}

export type SummaryTone = "normal" | "factbomb";

export function resolvePlanSummary(params: {
  formOrigin: string;
  destination: string;
  country: string;
  nights: number;
  totalBudget: number;
  people: number;
  perPerson: number;
  allowedRegions: string[];
}): { summary: string; tone: SummaryTone } {
  const factBomb = buildBudgetFactBomb({
    perPerson: params.perPerson,
    totalBudget: params.totalBudget,
    people: params.people,
    destination: params.destination,
    country: params.country,
    allowedRegions: params.allowedRegions,
  });

  if (factBomb) {
    return { summary: factBomb, tone: "factbomb" };
  }

  return {
    summary: `${params.formOrigin}에서 ${params.destination}로 떠나는 ${params.nights + 1}일 일정이에요. 총예산 ${params.totalBudget.toLocaleString(
      "ko-KR"
    )}원을 ${params.people}명으로 나눠 1인당 약 ${params.perPerson.toLocaleString(
      "ko-KR"
    )}원 기준으로 항공·숙소·일정을 맞춰 드렸어요.`,
    tone: "normal",
  };
}
