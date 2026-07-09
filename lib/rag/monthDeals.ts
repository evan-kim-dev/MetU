/**
 * 유연 일정(월 선택)용 시즌 RAG.
 * 저렴한 권역 + 날씨/성수기 주의사항을 함께 제공한다.
 */

export interface MonthDealTip {
  month: number;
  /** 항공·숙소가 상대적으로 나은 곳 */
  cheapPlaces: string[];
  /** 한 줄 요약: 왜 싸거나 인기인지 */
  dealReason: string;
  /** 주의(장마/태풍/성수기 등) */
  caution: string;
}

export const MONTH_DEAL_TIPS: MonthDealTip[] = [
  {
    month: 1,
    cheapPlaces: ["런던", "파리", "오사카", "방콕"],
    dealReason:
      "연초 비수기라 유럽(영국·프랑스) 항공·숙소가 성수기보다 크게 내려가고, 아시아 근거리도 특가가 많아요",
    caution:
      "유럽은 한파·짧은 일조·우천이 잦고, 일본·동남아도 방한·건조기 대비가 필요해요. 예산이 여유 있을 때만 유럽을 보세요",
  },
  {
    month: 2,
    cheapPlaces: ["파리", "런던", "프라하", "오사카"],
    dealReason:
      "유럽 겨울 비수기(발렌타인·반학기 제외)엔 영국·프랑스·동유럽이 상대적으로 저렴하고, 설 연휴만 피하면 일본도 무난해요",
    caution:
      "설 연휴·반학기 방학이 겹치면 급등해요. 유럽은 추위·일조 부족이 있으니 실내 명소·카페 비중을 높이세요",
  },
  {
    month: 3,
    cheapPlaces: ["도쿄", "오사카", "제주", "타이베이"],
    dealReason: "벚꽃 시즌 초반이라 일본·제주 수요가 많지만 평일엔 딜이 나와요",
    caution: "중순 이후 벚꽃 성수기로 숙소가 빨리 마감될 수 있어요",
  },
  {
    month: 4,
    cheapPlaces: ["교토", "도쿄", "제주", "부산"],
    dealReason: "봄 성수기지만 국내·근거리 일본은 짧은 연휴에 잘 맞는 달이에요",
    caution: "골든위크(일본)와 겹치면 항공·숙소가 급등해요",
  },
  {
    month: 5,
    cheapPlaces: ["오사카", "방콕", "다낭", "홍콩"],
    dealReason: "초여름 직전이라 동남아·근교 일본이 가성비 좋은 구간이에요",
    caution: "동남아는 더위가 시작되니 실내·오전이 편한 동선이 좋아요",
  },
  {
    month: 6,
    cheapPlaces: ["후쿠오카", "방콕", "발리", "타이베이"],
    dealReason: "장마 전후로 비인기 권역은 특가가 자주 열려요",
    caution: "한국·일본은 장마, 동남아는 우기 시작이라 실내 일정을 늘려주세요",
  },
  {
    month: 7,
    cheapPlaces: ["다낭", "오키나와", "발리", "오사카"],
    dealReason: "여름 휴가철이라 일본·동남아 패키지·특별편이 많아 저가 항공을 찾기 좋아요",
    caution: "장마·태풍·폭염 가능성이 있어 일정에 여유를 두고, 해안은 기상 특보를 꼭 확인하세요",
  },
  {
    month: 8,
    cheapPlaces: ["다낭", "홋카이도", "오키나와", "부산"],
    dealReason: "피서 수요가 커 근거리·북일본·동남아 해변 노선이 활발해요",
    caution: "태풍 시즌 절정이라 항공 결항·연착 리스크가 있어요. 보험·유연 항공권을 추천해요",
  },
  {
    month: 9,
    cheapPlaces: ["삿포로", "타이베이", "오사카", "홍콩"],
    dealReason: "성수기 직후라 항공·숙소가 한숨 돌며 가성비 구간이에요",
    caution: "초반은 잔여 태풍, 후반은 환절기라 얇은 겉옷을 챙기세요",
  },
  {
    month: 10,
    cheapPlaces: ["도쿄", "오사카", "파리(비수기 초입)", "타이베이"],
    dealReason: "가을 단풍·여행 성수기지만 주중 출발이면 딜이 잘 나와요",
    caution: "단풍 명소·유럽은 주말 숙소 경쟁이 세니 미리 예약하세요",
  },
  {
    month: 11,
    cheapPlaces: ["도쿄", "타이베이", "홍콩", "방콕"],
    dealReason: "연말 성수기 전 비수기라 아시아 근·중거리 특가가 많아요",
    caution: "북반구는 추워지기 시작하니 방한을, 동남아는 건조기를 대비하세요",
  },
  {
    month: 12,
    cheapPlaces: ["삿포로", "오사카", "방콕", "다낭"],
    dealReason: "연말연시 전 평일은 특가가, 연휴는 성수기예요",
    caution: "크리스마스·연말 연휴는 가격이 크게 오르니 날짜를 살짝 비껴가세요",
  },
];

export function getMonthDealTip(month: number): MonthDealTip {
  return (
    MONTH_DEAL_TIPS.find((t) => t.month === month) ?? MONTH_DEAL_TIPS[6]
  );
}

export function formatMonthDealInsight(month: number): string {
  const tip = getMonthDealTip(month);
  const places = tip.cheapPlaces.slice(0, 3).join("·");
  return `${month}월엔 ${places} 쪽이 비교적 저렴한 편이에요. ${tip.dealReason}. 다만 ${tip.caution}`;
}
