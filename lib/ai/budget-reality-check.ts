import { getBudgetBand, retrieveBudgetRag, BUDGET_BAND_DOCS } from "@/lib/rag/budgetBands";
import { AIRPORT_PLACES } from "@/lib/airports/data";
import { backendFetch } from "@/lib/backend/client";
import {
  buildFactBombPrompt,
  buildNormalPlanSummaryPrompt,
  getFactBombSystemPrompt,
  getSummarySystemPrompt,
} from "@/lib/ai/prompts/insight-prompts";

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

const DOMESTIC_KEYWORDS = ["제주", "부산", "서울", "국내", "대한민국", "강릉", "전주"];

const ASIA_NEAR_KEYWORDS = [
  "도쿄",
  "오사카",
  "후쿠오카",
  "다낭",
  "방콕",
  "타이베이",
  "세부",
  "홍콩",
  "싱가포르",
  "발리",
  "괌",
  "오키나와",
];

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
    const key = normalizeText(region.replace(/\(.*?\)/g, "").trim());
    if (!key) return false;
    return text.includes(key) || key.includes(normalizeText(destination));
  });
}

/** 앱이 아는 실제 여행지인지 (공항 DB + 예산 밴드 권역 + 주요 키워드) */
function isKnownTravelDestination(
  destination: string,
  country: string
): boolean {
  const text = normalizeText(`${destination} ${country}`);
  if (!text || text.length < 2) return false;

  if (
    mentionsAny(text, [
      ...EUROPE_KEYWORDS,
      ...LONG_HAUL_KEYWORDS,
      ...DOMESTIC_KEYWORDS,
      ...ASIA_NEAR_KEYWORDS,
    ])
  ) {
    return true;
  }

  const bandHit = BUDGET_BAND_DOCS.some((band) =>
    band.regions.some((region) => {
      const key = normalizeText(region.replace(/\(.*?\)/g, "").trim());
      return key.length >= 2 && (text.includes(key) || key.includes(text));
    })
  );
  if (bandHit) return true;

  return AIRPORT_PLACES.some((place) => {
    const hay = normalizeText(
      `${place.city} ${place.country} ${place.name} ${place.keywords.join(" ")} ${place.code ?? ""}`
    );
    const dest = normalizeText(destination);
    return (
      hay.includes(dest) ||
      dest.includes(normalizeText(place.city)) ||
      place.keywords.some((k) => normalizeText(k) === dest)
    );
  });
}

/** 현재 1인 예산으로 갈 수 있는 권역에 목적지가 포함되는지 */
function isAffordableForPerPersonBudget(
  destination: string,
  country: string,
  perPerson: number
): boolean {
  const text = normalizeText(`${destination} ${country}`);
  const affordableRegions = BUDGET_BAND_DOCS.filter(
    (band) => perPerson >= band.minPerPerson
  ).flatMap((band) => band.regions);

  if (
    affordableRegions.some((region) => {
      const key = normalizeText(region.replace(/\(.*?\)/g, "").trim());
      return key.length >= 2 && (text.includes(key) || key.includes(normalizeText(destination)));
    })
  ) {
    return true;
  }

  // 키워드 기반 예산 하한
  if (mentionsAny(text, DOMESTIC_KEYWORDS) && perPerson >= 150_000) return true;
  if (mentionsAny(text, ASIA_NEAR_KEYWORDS) && perPerson >= 500_000) return true;
  if (mentionsAny(text, EUROPE_KEYWORDS) && perPerson >= 2_500_000) return true;
  if (mentionsAny(text, LONG_HAUL_KEYWORDS) && perPerson >= 4_000_000) return true;

  return false;
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

function isUnrealisticBudgetDestination(
  input: BudgetRealityInput
): boolean {
  const { perPerson, destination, country, allowedRegions } = input;
  const text = normalizeText(`${destination} ${country}`);

  // 1) 지도에도 없는 말 (천국, asdf 등) → 무조건 팩트폭격
  if (!isKnownTravelDestination(destination, country)) {
    return true;
  }

  // 2) 예산 절대 부족
  if (perPerson < 300_000 && !mentionsAny(text, DOMESTIC_KEYWORDS)) {
    return true;
  }

  if (mentionsAny(text, EUROPE_KEYWORDS) && perPerson < 2_500_000) {
    return true;
  }

  if (mentionsAny(text, LONG_HAUL_KEYWORDS) && perPerson < 4_000_000) {
    return true;
  }

  // 3) 아는 여행지지만 이 예산 밴드로는 무리
  if (!isAffordableForPerPersonBudget(destination, country, perPerson)) {
    return true;
  }

  // 4) 현재 밴드 허용 목록 밖 + 고가 권역
  if (!isInAllowedRegions(destination, country, allowedRegions)) {
    if (mentionsAny(text, [...EUROPE_KEYWORDS, ...LONG_HAUL_KEYWORDS])) {
      // 예산은 충분해도 "이 밴드 추천 밖"이면 대안 안내가 나을 수 있음 —
      // 다만 유럽 진입 밴드(250만+)에서 파리 등은 허용되므로 여기선 이미 통과.
      if (perPerson < 2_500_000) return true;
    }
  }

  return false;
}

function buildBudgetFactBomb(input: BudgetRealityInput): string | null {
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
  const known = isKnownTravelDestination(destination, country);
  const km = estimateDistanceKm(destination, country);
  const alt =
    allowedRegions.slice(0, 3).join("·") || "예산을 더 모은 뒤";
  const band = getBudgetBand(perPerson);
  const flightOnlyHint =
    perPerson < 1_000_000
      ? "항공값만 해도 예산이 증발할 가능성 99%"
      : "항공+숙소만 해도 예산이 빠듯해요";

  const nonsenseTemplates = [
    `"${destination}"이요? 그건 항공권 검색창에 안 뜨는 여행지예요. 현실적인 도시부터 골라주세요.`,
    `${label} 가는 비행기는 아직 발명 전이에요. ${alt} 같은 실제 목적지로 다시 짜보죠.`,
    `팩트폭격: "${destination}"는 여행지가 아니라 소원이에요. 예산 ${perLabel}으론 ${alt}가 정답이에요.`,
  ];

  const templates =
    !known
      ? nonsenseTemplates
      : allowedRegions.length === 0
        ? [
            `1인당 ${perLabel}으로 ${label}? 말 되는 소리 좀 해봐요. 지금은 목적지보다 예산부터예요.`,
            `총 ${totalLabel}(${people}명)으로 ${label}는 ${flightOnlyHint}. 돼지저금통부터 털어보실래요? 🐷`,
            `${label} 티켓은 예산한테 먼저 사과받으세요. 숙박 여행 자체가 아직 일러요.`,
          ]
        : [
            `1인당 ${perLabel}으로 ${label}? 말 되는 소리 좀 해봐요. 서울에서 약 ${km.toLocaleString("ko-KR")}km니까 수영 ${km.toLocaleString("ko-KR")}번 하면 도착이에요 🏊`,
            `${label} 가고 싶다고요? 그건 제가 아는 ${formatBudgetLabel(perPerson)} 여행이 아니에요. 현실은 ${alt} 쪽이에요.`,
            `총 ${totalLabel}(${people}명)으로 ${label}는 ${flightOnlyHint}. 아니면 돼지저금통부터 털어보실래요? 🐷`,
            `예산 ${perLabel}에 ${label}는 밈으로도 빡세요. "현실 좀 봐" 버전 추천지는 ${alt}예요.`,
            `${label} 티켓은 예산한테 먼저 사과받으세요. 이 정도면 ${band.nights} ${alt}이 정답이에요.`,
            `${destination} 가려면 지갑부터 유럽 가야 해요. 지금 예산으론 ${alt}나 가보죠. (진심)`,
          ];

  const seed = `${destination}-${perPerson}-${totalBudget}`;
  return templates[pickTemplateIndex(seed, templates.length)];
}

export type SummaryTone = "normal" | "factbomb";

function buildNormalSummary(params: {
  formOrigin: string;
  destination: string;
  nights: number;
  totalBudget: number;
  people: number;
  perPerson: number;
}): string {
  return `${params.formOrigin}에서 ${params.destination}로 떠나는 ${params.nights + 1}일 일정이에요. 총예산 ${params.totalBudget.toLocaleString(
    "ko-KR"
  )}원을 ${params.people}명으로 나눠 1인당 약 ${params.perPerson.toLocaleString(
    "ko-KR"
  )}원 기준으로 항공·숙소·일정을 맞춰 드렸어요.`;
}

type SummaryParams = {
  formOrigin: string;
  destination: string;
  country: string;
  nights: number;
  totalBudget: number;
  people: number;
  perPerson: number;
  allowedRegions: string[];
  month: number;
  styleLabels?: string[];
};

/** AI 없이 즉시 쓸 수 있는 로컬/템플릿 요약 */
export function resolvePlanSummaryLocal(
  params: SummaryParams
): { summary: string; tone: SummaryTone; source: "local" | "template" } {
  const realityInput = {
    perPerson: params.perPerson,
    totalBudget: params.totalBudget,
    people: params.people,
    destination: params.destination,
    country: params.country,
    allowedRegions: params.allowedRegions,
  };

  if (!isUnrealisticBudgetDestination(realityInput)) {
    return {
      summary: buildNormalSummary(params),
      tone: "normal",
      source: "local",
    };
  }

  const rag = retrieveBudgetRag(params.perPerson, params.month);
  const summary =
    buildBudgetFactBomb({
      ...realityInput,
      allowedRegions: rag.allowedRegions,
    }) ??
    `${params.destination}는 지금 예산에 안 맞아요. ${rag.allowedRegions
      .slice(0, 3)
      .join("·")}을 먼저 보세요.`;

  return { summary, tone: "factbomb", source: "template" };
}

/**
 * RAG 컨텍스트 + OpenRouter AI로 일정 요약/팩트폭격 생성.
 * AI 실패 시 템플릿 폴백.
 */
export async function resolvePlanSummaryWithRag(
  params: SummaryParams
): Promise<{ summary: string; tone: SummaryTone; source: "ai+rag" | "template" | "local" }> {
  const local = resolvePlanSummaryLocal(params);
  const rag = retrieveBudgetRag(params.perPerson, params.month);

  if (local.tone === "normal") {
    try {
      const res = await backendFetch("/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          system: getSummarySystemPrompt(),
          prompt: buildNormalPlanSummaryPrompt({
            origin: params.formOrigin,
            destination: params.destination,
            country: params.country,
            nights: params.nights,
            people: params.people,
            totalBudget: params.totalBudget,
            perPerson: params.perPerson,
            styleLabels: params.styleLabels ?? [],
            ragContexts: [
              ...rag.contexts,
              rag.seasonTip,
              `허용 권역: ${rag.allowedRegions.join(", ")}`,
            ],
          }),
          mode: "summary",
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          content?: string | null;
          source?: string;
        };
        const content = data.content?.trim();
        if (
          content &&
          data.source === "ai" &&
          content.length >= 12 &&
          content.length <= 480
        ) {
          return { summary: content, tone: "normal", source: "ai+rag" };
        }
      }
    } catch {
      // fall through to local
    }

    return { ...local, source: "local" };
  }

  const system = getFactBombSystemPrompt();
  const prompt = buildFactBombPrompt({
    destination: params.destination,
    country: params.country,
    perPerson: params.perPerson,
    totalBudget: params.totalBudget,
    people: params.people,
    nights: params.nights,
    month: params.month,
  });

  try {
    const res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ system, prompt, mode: "factbomb" }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        content?: string | null;
        source?: string;
      };
      const content = data.content?.trim();
      if (content && data.source === "ai" && content.length >= 12 && content.length <= 480) {
        return { summary: content, tone: "factbomb", source: "ai+rag" };
      }
    }
  } catch {
    // fall through to template
  }

  return { ...local, source: "template" };
}
