/**
 * 예산 구간 RAG — 1인당 예산 기준의 현실적 권역 가이드.
 * (한국 출발, 왕복항공+숙소+현지비 대략치)
 */

export interface BudgetBandDoc {
  id: string;
  /** 1인당 하한(원) */
  minPerPerson: number;
  /** 1인당 상한(원, 미포함) */
  maxPerPerson: number;
  nights: string;
  regions: string[];
  seasonHints: Record<number, string>;
  content: string;
}

export const BUDGET_BAND_DOCS: BudgetBandDoc[] = [
  {
    id: "band-insufficient",
    minPerPerson: 0,
    maxPerPerson: 150_000,
    nights: "숙박 여행 비권장",
    regions: [],
    seasonHints: {
      7: "예산을 올린 뒤 국내 근교부터 다시 보세요",
      8: "예산을 올린 뒤 국내 근교부터 다시 보세요",
    },
    content:
      "1인당 15만원 미만이면 왕복 교통+숙박 여행은 비현실적이다. 목적지를 추천하지 말고 총 예산을 올리거나 인원을 줄이라고 안내한다. 제주·타이베이·일본·동남아는 절대 말하지 않는다.",
  },
  {
    id: "band-domestic-micro",
    minPerPerson: 150_000,
    maxPerPerson: 300_000,
    nights: "당일치기~1박",
    regions: ["부산", "강릉", "전주"],
    seasonHints: {
      7: "무더위라 실내·야경 위주 국내 근교가 무난해요",
      8: "피서 수요가 있어 주중 국내 근교가 유리해요",
    },
    content:
      "1인당 15~30만원이면 국내 근교 당일치기~1박만 현실적이다. 제주 2박·타이베이·일본·동남아는 항공만으로도 예산을 넘기기 쉽다.",
  },
  {
    id: "band-near-short",
    minPerPerson: 300_000,
    maxPerPerson: 500_000,
    nights: "2~3박",
    regions: ["부산", "제주", "후쿠오카"],
    seasonHints: {
      7: "제주·부산 해변, 후쿠오카는 실내·야시장 위주",
      8: "제주보다 부산·후쿠오카가 상대적으로 선선한 편",
    },
    content:
      "1인당 30~50만원이면 국내 2~3박 또는 후쿠오카 초단기만 현실적이다. 타이베이·동남아·도쿄는 아직 빠듯하고, 유럽·미주는 불가능에 가깝다.",
  },
  {
    id: "band-sea-near",
    minPerPerson: 500_000,
    maxPerPerson: 900_000,
    nights: "3~4박",
    regions: ["다낭", "방콕", "오사카", "타이베이", "세부"],
    seasonHints: {
      7: "다낭·오키나와·발리는 여름휴가지만 우기/태풍을 참고",
      8: "동남아·일본 근교가 안정적",
    },
    content:
      "1인당 50~90만원이면 동남아·근교 일본·타이베이 3~4박이 핵심 구간이다. 유럽은 항공만으로도 예산을 초과하기 쉽다.",
  },
  {
    id: "band-mid-asia",
    minPerPerson: 900_000,
    maxPerPerson: 1_600_000,
    nights: "4~5박",
    regions: ["도쿄", "오사카", "홍콩", "싱가포르", "발리"],
    seasonHints: {
      7: "발리·오키나와·다낭 여름휴가, 도쿄는 무더위·성수기 주의",
      8: "일본·동남아 중거리, 유럽은 여전히 빠듯",
    },
    content:
      "1인당 90~160만원이면 일본·홍콩·싱가포르·발리 중거리가 적절하다. 유럽 왕복항공이 보통 80~150만+라 짧은 일정조차 빠듯하다.",
  },
  {
    id: "band-premium-asia",
    minPerPerson: 1_600_000,
    maxPerPerson: 2_500_000,
    nights: "5~6박",
    regions: ["도쿄", "발리", "싱가포르", "시드니(짧게)", "괌"],
    seasonHints: {
      7: "발리·괌·오키나와 리조트형, 유럽은 최소 일정만 가능할지 검토",
      8: "아시아 프리미엄·호주 짧게",
    },
    content:
      "1인당 160~250만원이면 아시아 프리미엄/여유 일정이 맞다. 유럽은 초단기로도 빠듯하고, 7일 유럽은 비현실적이다.",
  },
  {
    id: "band-europe-entry",
    minPerPerson: 2_500_000,
    maxPerPerson: 4_000_000,
    nights: "5~7박",
    regions: ["파리", "로마", "프라하", "부다페스트", "바르셀로나"],
    seasonHints: {
      7: "유럽 성수기라 숙소·항공이 비싸니 동유럽·비인기 거점이 유리",
      8: "파리·로마보다 프라하·부다페스트가 상대적으로 가성비",
    },
    content:
      "1인당 250만원 이상부터 유럽 단기(5~7박)를 검토할 수 있다. 항공만 80~150만+인 경우가 많아 그 미만 예산에 유럽을 넣으면 안 된다.",
  },
  {
    id: "band-longhaul",
    minPerPerson: 4_000_000,
    maxPerPerson: Number.POSITIVE_INFINITY,
    nights: "7박+",
    regions: ["런던", "뉴욕", "시드니", "파리", "로마"],
    seasonHints: {
      7: "장거리도 가능하나 성수기 프리미엄 주의",
      8: "미주·유럽·호주 장거리",
    },
    content:
      "1인당 400만원 이상이면 장거리·여유 일정(런던·뉴욕·시드니 등)이 현실적이다.",
  },
];

export function getBudgetBand(perPerson: number): BudgetBandDoc {
  return (
    BUDGET_BAND_DOCS.find(
      (b) => perPerson >= b.minPerPerson && perPerson < b.maxPerPerson
    ) ?? BUDGET_BAND_DOCS[0]
  );
}

export function retrieveBudgetRag(
  perPerson: number,
  month: number
): {
  band: BudgetBandDoc;
  contexts: string[];
  allowedRegions: string[];
  seasonTip: string;
} {
  const band = getBudgetBand(perPerson);
  const seasonTip =
    band.regions.length === 0
      ? "예산을 올린 뒤 다시 추천받는 게 좋아요"
      : (band.seasonHints[month] ??
        `${month}월에는 ${band.regions.slice(0, 2).join("·")}이 무난해요`);

  const neighbors = BUDGET_BAND_DOCS.filter(
    (b) =>
      Math.abs(b.minPerPerson - band.minPerPerson) <= 1_600_000 ||
      b.id === band.id
  ).slice(0, 3);

  const contexts = [
    band.content,
    band.regions.length > 0
      ? `허용 권역(반드시 이 안에서만): ${band.regions.join(", ")}`
      : "허용 권역 없음 — 목적지 추천 금지, 예산 상향만 안내",
    `권장 박수: ${band.nights}`,
    `시즌(${month}월): ${seasonTip}`,
    ...neighbors
      .filter((b) => b.id !== band.id)
      .map((b) => `[참고] ${b.content}`),
  ];

  return {
    band,
    contexts,
    allowedRegions: band.regions,
    seasonTip,
  };
}

/** AI 응답이 허용 권역을 벗어나면 true */
export function violatesBudgetBand(
  text: string,
  perPerson: number
): boolean {
  const band = getBudgetBand(perPerson);
  const lower = text.toLowerCase();

  const europeWords = [
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
  ];
  const longHaulWords = ["뉴욕", "시드니", "LA", "로스앤젤레스", "하와이", "미주"];

  const mentionsEurope = europeWords.some((w) => text.includes(w));
  const mentionsLong = longHaulWords.some((w) =>
    lower.includes(w.toLowerCase())
  );

  // 유럽은 250만 미만 금지
  if (mentionsEurope && perPerson < 2_500_000) return true;
  // 장거리는 400만 미만 금지
  if (mentionsLong && perPerson < 4_000_000) return true;

  // 초저예산에서 해외·제주  overnight 추천 차단
  if (
    perPerson < 150_000 &&
    /(제주|타이베이|후쿠오카|오사카|다낭|방콕|도쿄|홍콩|발리|세부)/.test(text)
  ) {
    return true;
  }
  if (
    perPerson < 300_000 &&
    /(타이베이|오사카|다낭|방콕|도쿄|홍콩|발리|세부|싱가포르)/.test(text)
  ) {
    return true;
  }
  if (perPerson < 500_000 && /(타이베이|다낭|방콕|세부|발리|싱가포르)/.test(text)) {
    return true;
  }

  // 허용 목록에 없는 고비용 권역을 강조하면 차단 (느슨한 검사)
  if (perPerson < 1_600_000 && /7\s*일|일주일|7박/.test(text) && mentionsEurope) {
    return true;
  }

  return false;
}
