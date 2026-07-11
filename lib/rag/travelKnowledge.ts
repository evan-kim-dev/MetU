import type { OnboardingForm } from "@/components/onboarding/types";

export interface RagSource {
  id: string;
  category: "예산" | "시즌" | "항공" | "숙소" | "스타일" | "일정";
  title: string;
  content: string;
}

interface KnowledgeDoc {
  id: string;
  category: RagSource["category"];
  title: string;
  tags: string[];
  content: string;
}

const KNOWLEDGE_BASE: KnowledgeDoc[] = [
  {
    id: "flight-booking-window",
    category: "항공",
    title: "항공 예약 타이밍",
    tags: ["flight", "all"],
    content:
      "국제선 항공권은 보통 출발 6~8주 전에 예약하면 평균 8~15% 저렴해요. 주말보다 화·수 출발이 더 싼 경우가 많아요.",
  },
  {
    id: "hotel-location",
    category: "숙소",
    title: "숙소 위치 전략",
    tags: ["hotel", "all"],
    content:
      "숙소는 주요 역·관광지에서 15분 이내로 잡으면 교통비와 이동 시간이 줄어요. 조식 포함이면 식비도 더 안정적이에요.",
  },
  {
    id: "food-budget",
    category: "스타일",
    title: "맛집 예산 배분",
    tags: ["food"],
    content:
      "맛집 중심 여행은 식비를 총예산의 18~25%로 잡는 게 안전해요. 인기 레스토랑은 최소 1~2주 전 예약을 추천해요.",
  },
  {
    id: "shopping-buffer",
    category: "스타일",
    title: "쇼핑 버퍼",
    tags: ["shopping", "hotplace"],
    content:
      "쇼핑·핫플 위주 일정이면 예산의 10~15%를 변동 지출 버퍼로 남겨 두는 게 좋아요 위험을 줄여요.",
  },
  {
    id: "healing-schedule",
    category: "스타일",
    title: "힐링 일정 밀도",
    tags: ["healing", "nature"],
    content:
      "힐링·자연 여행은 하루 2~3개 핵심 일정만 두고 휴식 블록을 넣으면 만족도가 높아요. 숙소 품질 비중을 조금 더 올려 보세요.",
  },
  {
    id: "culture-pass",
    category: "스타일",
    title: "문화·관광 패스",
    tags: ["culture", "sightseeing"],
    content:
      "관광·문화 일정은 시티패스나 통합 입장권으로 동선과 비용을 같이 줄일 수 있어요. 오전 인기 명소, 오후 실내 코스가 효율적이에요.",
  },
  {
    id: "flexible-month",
    category: "일정",
    title: "유연 일정 항공",
    tags: ["flexible", "all"],
    content:
      "언제든지(유연 일정)로 월을 고르면, 그달 중순 평일 출발이 성수기보다 가격 변동이 적고 항공권도 찾기 쉬워요.",
  },
  {
    id: "specific-date",
    category: "일정",
    title: "날짜 고정 전략",
    tags: ["specific", "all"],
    content:
      "날짜를 고정하면 가격 탄력성이 낮아서, 항공권과 숙소를 먼저 확정한 뒤 나머지 예산을 나누는 편이 유리해요.",
  },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function formKeywords(form: OnboardingForm): string[] {
  const base = [
    form.origin,
    form.destination,
    form.dateType === "flexible" ? "flexible" : "specific",
  ];
  const styleWords = form.styles.map((s) => s.toLowerCase());
  return tokenize([...base, ...styleWords].join(" "));
}

export function retrieveTravelSources(
  form: OnboardingForm,
  topK = 4
): RagSource[] {
  const keywords = formKeywords(form);

  const scored = KNOWLEDGE_BASE.map((doc) => {
    const docTokens = tokenize(`${doc.tags.join(" ")} ${doc.content}`);
    const score = keywords.reduce(
      (acc, word) => (docTokens.includes(word) ? acc + 1 : acc),
      0
    );
    return { doc, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ doc }) => ({
      id: doc.id,
      category: doc.category,
      title: doc.title,
      content: doc.content,
    }));

  if (scored.length > 0) return scored;

  return KNOWLEDGE_BASE.slice(0, topK).map((doc) => ({
    id: doc.id,
    category: doc.category,
    title: doc.title,
    content: doc.content,
  }));
}
