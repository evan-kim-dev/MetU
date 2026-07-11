import type { SmartTip } from "@/lib/mock/home";
import type { Trip } from "@/lib/trips/types";

type TipTemplate = Omit<SmartTip, "id">;

const DESTINATION_TIPS: Record<string, TipTemplate[]> = {
  도쿄: [
    {
      emoji: "🚃",
      title: "교통 패스",
      description:
        "도쿄 메트로 24/48/72시간 패스가 있으면 시내 이동비를 크게 줄일 수 있어요.",
    },
    {
      emoji: "💴",
      title: "환전 팁",
      description:
        "편의점 ATM보다 공항/도심 환전소 환율을 비교하면 체감 차이가 커요.",
    },
    {
      emoji: "🍜",
      title: "맛집 대기",
      description:
        "인기 라멘·스시는 오픈 직전이나 평일 오후가 대기 시간이 가장 짧아요.",
    },
    {
      emoji: "☔",
      title: "날씨 대비",
      description:
        "도쿄는 갑작스러운 소나기가 잦으니 접이식 우산을 가방에 넣어두세요.",
    },
  ],
  오사카: [
    {
      emoji: "🍢",
      title: "맛집 동선",
      description:
        "도톤보리·신사이바시는 저녁 피크 전에 이동하면 웨이팅을 줄일 수 있어요.",
    },
    {
      emoji: "🚃",
      title: "교통 절약",
      description:
        "오사카 주유패스(1일)로 지하철·버스를 무제한 이용하면 가성비가 좋아요.",
    },
    {
      emoji: "🛍️",
      title: "쇼핑 팁",
      description:
        "돈키호테는 심야보다 오전이 가격 비교·재고 확인에 더 편해요.",
    },
    {
      emoji: "🏯",
      title: "오사카성",
      description:
        "오사카성 공원은 오전 입장하면 사진 스팟 혼잡을 피하기 좋아요.",
    },
  ],
  런던: [
    {
      emoji: "💷",
      title: "환율 팁",
      description: "지금 파운드 환율이 최근 3개월 중 가장 낮은 편이에요.",
    },
    {
      emoji: "🎫",
      title: "교통 패스",
      description: "오이스터/컨택트리스로 지하철비를 크게 아낄 수 있어요.",
    },
    {
      emoji: "🍽️",
      title: "맛집 예약",
      description: "인기 레스토랑은 2주 전 예약이 거의 필수예요.",
    },
    {
      emoji: "☔",
      title: "날씨 대비",
      description: "오후 소나기가 잦으니 가벼운 우산을 챙기세요.",
    },
  ],
  파리: [
    {
      emoji: "🎟️",
      title: "교통권",
      description:
        " Navigo Easy나 1일권으로 메트로를 묶으면 단거리 이동 비용이 안정적이에요.",
    },
    {
      emoji: "🥐",
      title: "조식 전략",
      description:
        "유명 베이커리는 오전에 사서 공원에서 먹으면 식사비를 확 줄일 수 있어요.",
    },
    {
      emoji: "🖼️",
      title: "미술관",
      description:
        "루브르·오르세는 야간 개장일 입장하면 대기와 혼잡도가 낮아요.",
    },
    {
      emoji: "💶",
      title: "환전",
      description:
        "공항 환전보다 시내 은행/환전소 환율을 비교하는 편이 유리해요.",
    },
  ],
  방콕: [
    {
      emoji: "🚤",
      title: "이동 팁",
      description:
        "차 막힐 땐 BTS/MRT·보트 조합이 택시보다 빠르고 저렴한 경우가 많아요.",
    },
    {
      emoji: "🌶️",
      title: "길거리 음식",
      description:
        "손님이 많은 노점부터 고르면 위생·회전율 면에서 더 안심돼요.",
    },
    {
      emoji: "🛍️",
      title: "야시장",
      description:
        "챗삿잣·야시장은 오픈 직후가 사람·가격 흥정 모두 유리해요.",
    },
    {
      emoji: "💧",
      title: "더위 대비",
      description:
        "낮 기온이 높아 오전 관광·오후 쇼핑몰 동선이 체력 관리에 좋아요.",
    },
  ],
  다낭: [
    {
      emoji: "🏖️",
      title: "해변 타임",
      description:
        "미케비치는 오전·일몰 때가 사진과 온도 모두 가장 쾌적해요.",
    },
    {
      emoji: "🏍️",
      title: "이동 수단",
      description:
        "근거리 그랩바이크가 택시보다 저렴하고, 바나힐은 티켓 미리 구매가 유리해요.",
    },
    {
      emoji: "🍜",
      title: "현지 식사",
      description:
        "미꽝·분보후에 집중하면 식비를 안정적으로 관리할 수 있어요.",
    },
    {
      emoji: "💵",
      title: "결제 팁",
      description:
        "소도시는 현금 비중이 높으니 소액 동을 미리 준비해 두세요.",
    },
  ],
  타이베이: [
    {
      emoji: "🚇",
      title: "교통카드",
      description:
        "이즈카드(EasyCard)로 MRT·버스를 묶으면 이동비가 한결 편해요.",
    },
    {
      emoji: "🥟",
      title: "야시장",
      description:
        "스린·녕하 야시장은 평일 저녁이 주말보다 줄이 짧아요.",
    },
    {
      emoji: "🌡️",
      title: "날씨",
      description:
        "비가 잦은 편이라 작은 우산과 미끄럼 방지 신발이 유용해요.",
    },
    {
      emoji: "🍵",
      title: "카페 휴식",
      description:
        "오후에 북투·시내 카페에서 쉬며 동선을 재배치하면 체력이 덜 달아요.",
    },
  ],
};

const COUNTRY_TIPS: Record<string, TipTemplate[]> = {
  일본: [
    {
      emoji: "💴",
      title: "현금·IC카드",
      description:
        "소도시는 현금 비중이 높고, IC카드(Suica/ICOCA)가 있으면 이동이 편해요.",
    },
    {
      emoji: "🏪",
      title: "편의점 활용",
      description:
        "조식·간식은 편의점으로 대체하면 하루 식비를 크게 아낄 수 있어요.",
    },
    {
      emoji: "📶",
      title: "데이터",
      description:
        "포켓와이파이/eSIM을 미리 준비하면 지도·번역 앱 사용이 수월해요.",
    },
    {
      emoji: "🧳",
      title: "짐 배송",
      description:
        "공항↔호텔 짐 배송(다쿠빈)을 쓰면 환승·이동이 훨씬 가벼워요.",
    },
  ],
  영국: DESTINATION_TIPS.런던,
  프랑스: DESTINATION_TIPS.파리,
  태국: DESTINATION_TIPS.방콕,
  베트남: DESTINATION_TIPS.다낭,
  대만: DESTINATION_TIPS.타이베이,
};

const STYLE_TIPS: Record<string, TipTemplate> = {
  food: {
    emoji: "🍽️",
    title: "맛집 예약",
    description: "인기 맛집은 여행 전 1~2주 예약하면 실패 확률이 낮아요.",
  },
  shopping: {
    emoji: "🛍️",
    title: "쇼핑 예산",
    description: "총예산의 10~15%를 쇼핑 버퍼로 남겨두면 초과 지출을 막을 수 있어요.",
  },
  healing: {
    emoji: "🌿",
    title: "휴식 블록",
    description: "하루에 핵심 일정 2~3개만 잡고 오후에 휴식 타임을 넣어보세요.",
  },
  sightseeing: {
    emoji: "📸",
    title: "명소 동선",
    description: "인기 명소는 오전에, 실내·카페는 오후에 두면 대기 시간이 줄어요.",
  },
  culture: {
    emoji: "🏛️",
    title: "통합권",
    description: "박물관·시티패스 묶음권이 있으면 입장료를 한 번에 아낄 수 있어요.",
  },
};

const EMPTY_TRIP_TIPS: TipTemplate[] = [
  {
    emoji: "🧭",
    title: "여행지 고르기",
    description:
      "예산대를 먼저 정하면 AI가 항공·숙소 저가 노선 중심으로 후보를 좁혀줘요.",
  },
  {
    emoji: "🗓️",
    title: "일정 유연하게",
    description:
      "날짜를 ‘언제든지’로 두면 주중 출발 항공을 찾아 더 저렴하게 갈 수 있어요.",
  },
  {
    emoji: "💡",
    title: "스타일 선택",
    description:
      "맛집·힐링·핫플 중 관심 키워드만 골라도 맞춤 일정이 바로 만들어져요.",
  },
  {
    emoji: "✈️",
    title: "첫 계획 시작",
    description:
      "새로운 여행 계획하기를 누르면 예산 입력부터 AI 추천까지 이어져요.",
  },
];

const FALLBACK_TIPS: TipTemplate[] = [
  {
    emoji: "✈️",
    title: "항공 체크",
    description: "출발 48시간 전 온라인 체크인으로 좌석·수하물을 미리 확인하세요.",
  },
  {
    emoji: "💳",
    title: "해외 결제",
    description: "카드사에 해외 사용을 등록하고, 수수료 낮은 카드를 우선 쓰세요.",
  },
  {
    emoji: "📱",
    title: "오프라인 지도",
    description: "현지 지도·번역을 오프라인으로 저장해 두면 데이터가 없어도 안전해요.",
  },
  {
    emoji: "💰",
    title: "일일 예산",
    description: "남은 예산을 남은 일자로 나누면 하루 지출 한도가 명확해져요.",
  },
];

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function matchKey(target: string, table: Record<string, TipTemplate[]>): TipTemplate[] | null {
  const n = normalize(target);
  for (const [key, tips] of Object.entries(table)) {
    if (n.includes(normalize(key)) || normalize(key).includes(n)) return tips;
  }
  return null;
}

/** 진행 중인 여행 정보로 AI Tip을 생성한다. 없으면 계획 유도용 팁. */
export function buildTipsForTrip(trip: Trip | null | undefined): SmartTip[] {
  if (!trip) {
    return EMPTY_TRIP_TIPS.map((tip, i) => ({
      ...tip,
      id: `tip-empty-${i}`,
    }));
  }

  const byCity = matchKey(trip.destination, DESTINATION_TIPS);
  const byCountry = matchKey(trip.country, COUNTRY_TIPS);
  const base = [...(byCity ?? byCountry ?? FALLBACK_TIPS)];

  // 여행 스타일 팁을 앞에 1~2개 보강
  for (const style of trip.styles.slice(0, 2)) {
    const styleTip = STYLE_TIPS[style];
    if (!styleTip) continue;
    if (base.some((t) => t.title === styleTip.title)) continue;
    base.unshift(styleTip);
  }

  // 날짜/예산 맥락 팁
  if (trip.dDay > 0 && trip.dDay <= 14) {
    base.unshift({
      emoji: "⏰",
      title: `D-${trip.dDay} 준비`,
      description: `${trip.destination} 출발이 ${trip.dDay}일 남았어요. 항공 체크인·숙소 재확인을 지금 해보세요.`,
    });
  }

  const remaining = Math.max(trip.budget - trip.spent, 0);
  if (trip.budget > 0) {
    const usedRatio = Math.round((trip.spent / trip.budget) * 100);
    base.push({
      emoji: "📊",
      title: "예산 현황",
      description: `${trip.destination} 여행 예산의 ${usedRatio}%를 사용했어요. 남은 금액은 ₩${remaining.toLocaleString("ko-KR")}예요.`,
    });
  }

  return base.slice(0, 6).map((tip, i) => ({
    ...tip,
    id: `tip-${trip.id}-${i}`,
  }));
}
