import type { DaySchedule } from "@/lib/ai/types";
import type { TravelStyle } from "@/components/onboarding/types";
import type { DestinationAttraction } from "@/lib/ai/destination-knowledge";

type PoiItem = {
  time: string;
  title: string;
  detail?: string;
  kind: "food" | "activity" | "transport" | "free";
};
type PoiDay = { label: string; items: PoiItem[] };

/** 지오코딩·동선 최적화가 되도록 실제 장소명을 쓴 도시별 템플릿 */
const CITY_POI_DAYS: Record<string, PoiDay[]> = {
  싱가포르: [
    {
      label: "도착 · 마리나 베이",
      items: [
        { time: "14:00", title: "MRT → 마리나 베이", detail: "창이 공항에서 MRT로 시내 이동해요.", kind: "transport" },
        { time: "16:00", title: "숙소 체크인", detail: "Marina Bay / Bugis 쪽 숙소에 짐을 내려요.", kind: "free" },
        { time: "17:30", title: "Gardens by the Bay", detail: "Supertree Grove를 둘러보고 사진을 찍어요.", kind: "activity" },
        { time: "19:30", title: "Marina Bay Sands 전망", detail: "석양 무렵 베이 쪽 스카이라인을 봐요.", kind: "activity" },
        { time: "20:30", title: "Clarke Quay 저녁", detail: "강변 레스토랑에서 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "시티 핵심 관광",
      items: [
        { time: "09:30", title: "Merlion Park", kind: "activity" },
        { time: "11:00", title: "Helix Bridge · Marina Bay 산책", kind: "activity" },
        { time: "12:30", title: "Lau Pa Sat 점심", kind: "food" },
        { time: "14:30", title: "Chinatown · Buddha Tooth Relic Temple", kind: "activity" },
        { time: "17:00", title: "Maxwell Food Centre 간식", kind: "food" },
        { time: "19:00", title: "Boat Quay 야경", kind: "activity" },
      ],
    },
    {
      label: "센토사 · 해안",
      items: [
        { time: "10:00", title: "Sentosa Island 이동", kind: "transport" },
        { time: "11:00", title: "Siloso Beach 또는 Universal Studios Singapore", kind: "activity" },
        { time: "13:30", title: "Sentosa 점심", kind: "food" },
        { time: "16:00", title: "VivoCity / HarbourFront", kind: "activity" },
        { time: "19:00", title: "Tiong Bahru 저녁", kind: "food" },
      ],
    },
    {
      label: "문화 · 쇼핑",
      items: [
        { time: "10:00", title: "National Gallery Singapore 또는 Asian Civilisations Museum", kind: "activity" },
        { time: "12:30", title: "Kampong Glam · Haji Lane 점심", kind: "food" },
        { time: "15:00", title: "Orchard Road 쇼핑", kind: "activity" },
        { time: "18:30", title: "Ion Orchard / Takashimaya 저녁", kind: "food" },
        { time: "20:30", title: "Singapore Flyer 또는 Esplanade", kind: "activity" },
      ],
    },
    {
      label: "자연 · 여유",
      items: [
        { time: "09:30", title: "Singapore Botanic Gardens", kind: "activity" },
        { time: "12:00", title: "Dempsey Hill 브런치", kind: "food" },
        { time: "14:30", title: "Holland Village 카페", kind: "food" },
        { time: "17:00", title: "Little India 산책", kind: "activity" },
        { time: "19:00", title: "Tekka Centre 저녁", kind: "food" },
      ],
    },
    {
      label: "출발",
      items: [
        { time: "09:30", title: "체크아웃 & 근처 카페", kind: "free" },
        { time: "11:30", title: "Jewel Changi Airport", kind: "activity" },
        { time: "14:00", title: "Changi Airport 출국", kind: "transport" },
      ],
    },
  ],
  오사카: [
    {
      label: "도착 · 도톤보리",
      items: [
        { time: "14:00", title: "Kansai Airport 도착 · 난바 이동", kind: "transport" },
        { time: "16:00", title: "숙소 체크인 (Namba / Shinsaibashi)", kind: "free" },
        { time: "17:30", title: "Dotonbori · Glico Sign", kind: "activity" },
        { time: "19:00", title: "도톤보리 타코야키 · 라멘", kind: "food" },
      ],
    },
    {
      label: "성곽 · 성심교",
      items: [
        { time: "09:30", title: "Osaka Castle", kind: "activity" },
        { time: "12:30", title: "Tenmabashi 점심", kind: "food" },
        { time: "14:30", title: "Shinsaibashi Shopping Street", kind: "activity" },
        { time: "17:00", title: "Amerikamura", kind: "activity" },
        { time: "19:00", title: "Hozenji Yokocho 저녁", kind: "food" },
      ],
    },
  ],
  도쿄: [
    {
      label: "도착 · 시부야",
      items: [
        { time: "14:00", title: "Narita / Haneda 도착 · 시부야 이동", kind: "transport" },
        { time: "16:00", title: "숙소 체크인 (Shibuya / Shinjuku)", kind: "free" },
        { time: "17:30", title: "Shibuya Crossing · Hachiko", kind: "activity" },
        { time: "19:00", title: "센터가이 저녁", kind: "food" },
      ],
    },
  ],
  방콕: [
    {
      label: "도착 · 짜오프라야",
      items: [
        { time: "14:00", title: "Suvarnabhumi / Don Mueang 도착", kind: "transport" },
        { time: "16:00", title: "숙소 체크인 (Sukhumvit / Silom)", kind: "free" },
        { time: "18:00", title: "Asiatique / Chao Phraya 강변", kind: "activity" },
        { time: "19:30", title: "수상마켓 스타일 저녁 또는 팟타이", kind: "food" },
      ],
    },
  ],
  다낭: [
    {
      label: "도착 · 미케 비치",
      items: [
        { time: "14:00", title: "Da Nang International Airport 도착", kind: "transport" },
        { time: "16:00", title: "숙소 체크인 (My Khe Beach)", kind: "free" },
        { time: "17:30", title: "My Khe Beach 산책", kind: "activity" },
        { time: "19:00", title: "해산물 저녁", kind: "food" },
      ],
    },
  ],
  서울: [
    {
      label: "도착 · 시내",
      items: [
        {
          time: "14:00",
          title: "공항철도 → 서울역",
          detail: "인천/김포에서 공항철도나 버스로 시내에 들어와요.",
          kind: "transport",
        },
        {
          time: "16:00",
          title: "숙소 체크인",
          detail: "명동·홍대·강남 근처 숙소에 짐을 내려요.",
          kind: "free",
        },
        {
          time: "17:30",
          title: "경복궁",
          detail: "광화문 쪽에서 궁궐을 둘러보고 사진을 찍어요.",
          kind: "activity",
        },
        {
          time: "19:30",
          title: "광장시장 저녁",
          detail: "빈대떡·육회 같은 분식으로 가볍게 저녁을 먹어요.",
          kind: "food",
        },
      ],
    },
    {
      label: "북촌 · 익선",
      items: [
        { time: "09:30", title: "북촌 한옥마을", detail: "골목 한옥 풍경을 천천히 걸어요.", kind: "activity" },
        { time: "11:30", title: "삼청동 카페", detail: "북촌 근처 카페에서 쉬어 가요.", kind: "food" },
        { time: "14:00", title: "창덕궁 또는 인사동", detail: "궁궐이나 인사동 거리를 둘러봐요.", kind: "activity" },
        { time: "17:00", title: "익선동", detail: "한옥 골목 카페와 소품샵을 들러요.", kind: "activity" },
        { time: "19:00", title: "종로 저녁", detail: "골목 맛집에서 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "한강 · 성수",
      items: [
        { time: "10:00", title: "성수동 카페거리", detail: "성수 공방·카페를 둘러봐요.", kind: "activity" },
        { time: "12:30", title: "성수 점심", detail: "근처 맛집에서 점심을 먹어요.", kind: "food" },
        { time: "15:00", title: "서울숲", detail: "한강 근처 공원에서 산책해요.", kind: "activity" },
        { time: "18:00", title: "뚝섬한강공원", detail: "해 질 녘 한강 뷰를 즐겨요.", kind: "activity" },
        { time: "19:30", title: "성수 저녁", detail: "성수나 건대 쪽에서 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "홍대 · 야경",
      items: [
        { time: "10:00", title: "연남동 · 연트럴파크", detail: "연남동 골목과 공원을 걸어요.", kind: "activity" },
        { time: "12:30", title: "연남 브런치", detail: "브런치 카페에서 점심을 먹어요.", kind: "food" },
        { time: "15:00", title: "홍대 거리", detail: "거리 공연과 소품샵을 구경해요.", kind: "activity" },
        { time: "18:30", title: "망원한강공원 석양", detail: "석양 무렵 한강을 봐요.", kind: "activity" },
        { time: "20:00", title: "홍대 저녁", detail: "홍대 맛거리에서 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "강남 · 쇼핑",
      items: [
        { time: "10:00", title: "코엑스", detail: "별마당 도서관과 쇼핑몰을 둘러봐요.", kind: "activity" },
        { time: "12:30", title: "코엑스 몰 점심", detail: "푸드코트나 레스토랑에서 먹어요.", kind: "food" },
        { time: "15:00", title: "가로수길 또는 신사", detail: "카페와 편집샵을 들러요.", kind: "activity" },
        { time: "18:00", title: "강남역 저녁", detail: "강남 맛집에서 저녁을 먹어요.", kind: "food" },
        { time: "20:00", title: "서울스카이 또는 야경", detail: "야경 포인트를 짧게 들러요.", kind: "activity" },
      ],
    },
    {
      label: "출발",
      items: [
        { time: "09:30", title: "체크아웃", detail: "숙소에서 체크아웃하고 짐을 정리해요.", kind: "free" },
        { time: "11:00", title: "남대문시장 또는 명동", detail: "기념품을 사고 간단히 점심을 먹어요.", kind: "activity" },
        { time: "14:00", title: "공항·역으로 이동", detail: "공항철도나 KTX로 돌아가요.", kind: "transport" },
      ],
    },
  ],
  부산: [
    {
      label: "도착 · 해운대",
      items: [
        {
          time: "14:00",
          title: "김해공항 → 해운대",
          detail: "리무진이나 지하철로 해운대로 이동해요.",
          kind: "transport",
        },
        {
          time: "16:00",
          title: "숙소 체크인",
          detail: "해운대·센텀 쪽 숙소에 짐을 내려요.",
          kind: "free",
        },
        {
          time: "17:30",
          title: "해운대해수욕장",
          detail: "해변을 따라 산책해요.",
          kind: "activity",
        },
        {
          time: "19:30",
          title: "해운대 저녁",
          detail: "회나 씨푸드로 저녁을 먹어요.",
          kind: "food",
        },
      ],
    },
    {
      label: "광안 · 해변",
      items: [
        { time: "10:00", title: "동백섬 · 누리마루", detail: "동백섬 둘레길을 걸어요.", kind: "activity" },
        { time: "12:30", title: "해운대 점심", detail: "근처 맛집에서 점심을 먹어요.", kind: "food" },
        { time: "15:00", title: "광안리해수욕장", detail: "광안대교 뷰를 보며 쉬어요.", kind: "activity" },
        { time: "18:30", title: "광안리 석양", detail: "석양과 야경을 찍어요.", kind: "activity" },
        { time: "20:00", title: "광안리 저녁", detail: "해변 쪽으로 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "남포 · 자갈치",
      items: [
        { time: "10:00", title: "자갈치시장", detail: "시장을 둘러보고 해산물을 맛봐요.", kind: "activity" },
        { time: "12:00", title: "자갈치 점심", detail: "시장 안이나 근처에서 점심을 먹어요.", kind: "food" },
        { time: "14:00", title: "용두산공원", detail: "부산타워 쪽에서 시내를 내려다봐요.", kind: "activity" },
        { time: "16:00", title: "국제시장 · BIFF거리", detail: "남포동 골목을 걸어요.", kind: "activity" },
        { time: "19:00", title: "남포 저녁", detail: "남포동 맛거리에서 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "감천 · 영도",
      items: [
        { time: "10:00", title: "감천문화마을", detail: "알록달록 골목과 전망을 봐요.", kind: "activity" },
        { time: "12:30", title: "감천 카페 점심", detail: "마을 카페에서 쉬며 먹어요.", kind: "food" },
        { time: "15:00", title: "흰여울문화마을", detail: "영도 해안 산책로를 걸어요.", kind: "activity" },
        { time: "18:00", title: "태종대 또는 영도 저녁", detail: "바다 뷰를 보며 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "출발",
      items: [
        { time: "09:30", title: "체크아웃", detail: "숙소에서 체크아웃해요.", kind: "free" },
        { time: "11:00", title: "센텀시티 또는 벡스코", detail: "쇼핑·산책을 짧게 해요.", kind: "activity" },
        { time: "14:00", title: "공항·역 이동", detail: "김해공항이나 부산역으로 이동해요.", kind: "transport" },
      ],
    },
  ],
  제주: [
    {
      label: "도착 · 제주시",
      items: [
        {
          time: "14:00",
          title: "제주공항 도착",
          detail: "렌터카나 버스로 숙소로 이동해요.",
          kind: "transport",
        },
        {
          time: "16:00",
          title: "숙소 체크인",
          detail: "제주시·애월·서귀포 중 숙소에 짐을 내려요.",
          kind: "free",
        },
        {
          time: "17:30",
          title: "동문시장",
          detail: "올레시장에서 간식과 기념품을 봐요.",
          kind: "activity",
        },
        {
          time: "19:30",
          title: "제주시 저녁",
          detail: "고기국수나 해산물로 저녁을 먹어요.",
          kind: "food",
        },
      ],
    },
    {
      label: "애월 · 서쪽",
      items: [
        { time: "09:30", title: "한림공원 또는 협재해수욕장", detail: "서쪽 해변과 공원을 둘러봐요.", kind: "activity" },
        { time: "12:30", title: "애월 카페거리 점심", detail: "해안 카페에서 브런치를 먹어요.", kind: "food" },
        { time: "15:00", title: "곽지해수욕장 또는 한담해안산책로", detail: "바닷길을 천천히 걸어요.", kind: "activity" },
        { time: "18:30", title: "애월 석양", detail: "석양 명소에서 노을을 봐요.", kind: "activity" },
        { time: "20:00", title: "애월 저녁", detail: "애월 맛집에서 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "서귀포 · 남쪽",
      items: [
        { time: "10:00", title: "천지연폭포 또는 정방폭포", detail: "서귀포 폭포를 구경해요.", kind: "activity" },
        { time: "12:30", title: "서귀포 점심", detail: "흑돼지·갈치로 든든히 먹어요.", kind: "food" },
        { time: "15:00", title: "올레시장 · 이중섭거리", detail: "시장과 골목을 걸어요.", kind: "activity" },
        { time: "17:30", title: "쇠소깍 또는 보목", detail: "맑은 물을 보며 쉬어요.", kind: "activity" },
        { time: "19:30", title: "서귀포 저녁", detail: "바다 근처에서 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "성산 · 동쪽",
      items: [
        { time: "09:00", title: "성산일출봉", detail: "이른 시간 성산일출봉을 올라요.", kind: "activity" },
        { time: "12:00", title: "성산 점심", detail: "오분자기·해산물로 점심을 먹어요.", kind: "food" },
        { time: "14:00", title: "우도 또는 섭지코지", detail: "동쪽 대표 포인트를 골라 가요.", kind: "activity" },
        { time: "18:00", title: "세화해변 또는 월정리", detail: "동쪽 해변에서 여유를 즐겨요.", kind: "activity" },
        { time: "19:30", title: "동쪽 저녁", detail: "근처 식당에서 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "출발",
      items: [
        { time: "09:30", title: "체크아웃", detail: "숙소에서 체크아웃해요.", kind: "free" },
        { time: "11:00", title: "제주 기념품", detail: "공항 근처에서 선물을 사요.", kind: "activity" },
        { time: "13:00", title: "제주공항 이동", detail: "여유 있게 공항으로 가요.", kind: "transport" },
      ],
    },
  ],
  강릉: [
    {
      label: "도착 · 경포",
      items: [
        { time: "14:00", title: "강릉역 · 시내 이동", detail: "KTX/버스 후 시내로 이동해요.", kind: "transport" },
        { time: "16:00", title: "숙소 체크인", detail: "경포·안목 쪽 숙소에 짐을 내려요.", kind: "free" },
        { time: "17:30", title: "경포해변", detail: "바다를 따라 산책해요.", kind: "activity" },
        { time: "19:30", title: "강릉 초당 순두부", detail: "초당 순두부로 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "안목 · 커피",
      items: [
        { time: "10:00", title: "안목해변 커피거리", detail: "바다 보며 커피를 마셔요.", kind: "activity" },
        { time: "12:30", title: "안목 점심", detail: "해변 근처에서 점심을 먹어요.", kind: "food" },
        { time: "15:00", title: "강문해변 또는 사천", detail: "한적한 해변을 걸어요.", kind: "activity" },
        { time: "18:30", title: "경포호 석양", detail: "호수 쪽으로 석양을 봐요.", kind: "activity" },
        { time: "20:00", title: "강릉 저녁", detail: "시내 맛집에서 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "정동진 · 주문진",
      items: [
        { time: "09:30", title: "정동진", detail: "해변과 레일바이크 근처를 둘러봐요.", kind: "activity" },
        { time: "12:30", title: "정동진 점심", detail: "근처에서 점심을 먹어요.", kind: "food" },
        { time: "15:00", title: "주문진수산시장", detail: "시장에서 해산물을 골라 먹어요.", kind: "activity" },
        { time: "18:00", title: "주문진 저녁", detail: "회나 해물로 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "출발",
      items: [
        { time: "09:30", title: "체크아웃", detail: "숙소에서 체크아웃해요.", kind: "free" },
        { time: "11:00", title: "강릉 커피 한 잔", detail: "시내에서 카페를 들러요.", kind: "food" },
        { time: "13:00", title: "강릉역 이동", detail: "기차·버스로 돌아가요.", kind: "transport" },
      ],
    },
  ],
  전주: [
    {
      label: "도착 · 한옥마을",
      items: [
        { time: "14:00", title: "전주역 · 시내 이동", detail: "버스터미널·역에서 한옥마을로 이동해요.", kind: "transport" },
        { time: "16:00", title: "숙소 체크인", detail: "한옥마을 근처 숙소에 짐을 내려요.", kind: "free" },
        { time: "17:30", title: "전주한옥마을", detail: "경기전과 골목을 걸어요.", kind: "activity" },
        { time: "19:30", title: "전주비빔밥 저녁", detail: "비빔밥이나 콩나물국밥으로 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "한옥 · 맛집",
      items: [
        { time: "09:30", title: "경기전 · 오목대", detail: "한옥마을 핵심 스팟을 둘러봐요.", kind: "activity" },
        { time: "12:00", title: "한옥마을 점심", detail: "막걸리·빈대떡으로 점심을 먹어요.", kind: "food" },
        { time: "14:30", title: "남부시장 · 청년몰", detail: "시장과 소품샵을 구경해요.", kind: "activity" },
        { time: "17:00", title: "전동성당", detail: "성당과 주변을 사진으로 남겨요.", kind: "activity" },
        { time: "19:00", title: "전주 저녁", detail: "한옥마을 근처에서 저녁을 먹어요.", kind: "food" },
      ],
    },
    {
      label: "출발",
      items: [
        { time: "09:30", title: "체크아웃", detail: "숙소에서 체크아웃해요.", kind: "free" },
        { time: "11:00", title: "전주 카페", detail: "시내 카페에서 쉬어요.", kind: "food" },
        { time: "13:00", title: "터미널·역 이동", detail: "집으로 돌아가는 교통편으로 가요.", kind: "transport" },
      ],
    },
  ],
};

const CITY_ALIASES: Record<string, string> = {
  singapore: "싱가포르",
  싱가폴: "싱가포르",
  osaka: "오사카",
  tokyo: "도쿄",
  동경: "도쿄",
  bangkok: "방콕",
  danang: "다낭",
  "da nang": "다낭",
  seoul: "서울",
  서울시: "서울",
  서울특별시: "서울",
  busan: "부산",
  부산시: "부산",
  부산광역시: "부산",
  jeju: "제주",
  제주도: "제주",
  제주시: "제주",
  서귀포: "제주",
  서귀포시: "제주",
  gangneung: "강릉",
  강릉시: "강릉",
  jeonju: "전주",
  전주시: "전주",
};

function normalizeCityKey(city: string): string {
  const raw = city.trim().toLowerCase();
  if (!raw) return "";
  if (CITY_ALIASES[raw]) return CITY_ALIASES[raw];
  for (const key of Object.keys(CITY_POI_DAYS)) {
    if (raw.includes(key.toLowerCase()) || key.toLowerCase().includes(raw)) {
      return key;
    }
  }
  return city.trim();
}

function costFor(
  kind: PoiItem["kind"],
  budgets: { food: number; activity: number; transport: number }
): number {
  if (kind === "free") return 0;
  if (kind === "food") return budgets.food;
  if (kind === "transport") return budgets.transport;
  return budgets.activity;
}

function pickStyleDays(days: PoiDay[], styles: TravelStyle[]): PoiDay[] {
  // 스타일 힌트만 — 순서는 유지하고 라벨 미세 조정
  if (styles.includes("healing") && days[3]) {
    return days.map((d, i) =>
      i === 3 ? { ...d, label: d.label.includes("여유") ? d.label : `${d.label} · 힐링` } : d
    );
  }
  return days;
}

function mapPoiDaysToSchedule(
  assembled: PoiDay[],
  budgets: { food: number; activity: number; transport: number }
): DaySchedule[] {
  return assembled.map((day, index) => {
    const items = day.items.map((item) => ({
      time: item.time,
      title: item.title,
      detail:
        item.detail?.trim() ||
        `${item.title}에서 현지 분위기를 느껴 보세요. 이동·대기 시간까지 여유 있게 잡아 두면 좋아요해요.`,
      cost: costFor(item.kind, budgets),
    }));
    return {
      day: index + 1,
      label: day.label,
      items,
      dayTotal: items.reduce((sum, item) => sum + item.cost, 0),
    };
  });
}

function assembleTemplateDays(styled: PoiDay[], daysNeeded: number): PoiDay[] {
  const middle = styled.slice(1, Math.max(1, styled.length - 1));
  const assembled: PoiDay[] = [];
  assembled.push(styled[0]);
  for (let i = 1; i < daysNeeded - 1; i++) {
    assembled.push(middle[(i - 1) % Math.max(1, middle.length)] ?? styled[0]);
  }
  if (daysNeeded > 1) {
    assembled.push(styled[styled.length - 1]);
  }
  return assembled.slice(0, daysNeeded);
}

/**
 * 하드코딩 도시 POI가 있으면 반환. 없으면 null.
 */
export function buildDestinationPoiSchedule(
  city: string,
  nights: number,
  styles: TravelStyle[],
  budgets: { food: number; activity: number; transport: number }
): DaySchedule[] | null {
  const key = normalizeCityKey(city);
  const template = CITY_POI_DAYS[key];
  if (!template?.length) return null;

  const daysNeeded = Math.max(1, nights + 1);
  const styled = pickStyleDays(template, styles);
  return mapPoiDaysToSchedule(assembleTemplateDays(styled, daysNeeded), budgets);
}

export function hasHardcodedCityPois(city: string): boolean {
  const key = normalizeCityKey(city);
  return Boolean(CITY_POI_DAYS[key]?.length);
}

/**
 * 웹에서 가져온 attractions로 실명·상세 일정을 만든다.
 */
export function buildDynamicPoiSchedule(
  city: string,
  origin: string,
  nights: number,
  styles: TravelStyle[],
  budgets: { food: number; activity: number; transport: number },
  attractions: DestinationAttraction[]
): DaySchedule[] | null {
  if (!attractions.length) return null;

  const daysNeeded = Math.max(1, nights + 1);
  const styleSet = new Set(styles);
  const pool = attractions.filter((a) => a.name.trim().length >= 2);
  if (pool.length === 0) return null;

  let cursor = 0;
  const nextAttraction = () => {
    const a = pool[cursor % pool.length];
    cursor += 1;
    return a;
  };

  const shortName = (name: string, max = 12) => {
    const t = name.trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  };

  const themeLabel = (
    dayIndex: number,
    a: { name: string },
    b?: { name: string }
  ) => {
    if (dayIndex === 0) return `${city} 도착 · 적응`;
    if (dayIndex === daysNeeded - 1) return `${city} 출발 · 귀국`;
    if (b) return `${shortName(a.name)} · ${shortName(b.name)}`;
    return `${shortName(a.name)} 탐방`;
  };

  const days: PoiDay[] = [];

  // Day 1 — arrival
  {
    const first = nextAttraction();
    days.push({
      label: themeLabel(0, first),
      items: [
        {
          time: "14:00",
          title: `${city} 공항 도착 · 시내 이동`,
          detail: `${origin}에서 도착한 뒤 전철·버스·택시로 시내로 이동해요. 짐이 많으면 공항 리무진도 편해요.`,
          kind: "transport",
        },
        {
          time: "16:00",
          title: "숙소 체크인 & 휴식",
          detail: "시내 중심·주요 역 근처 숙소에 짐을 내려놓고 가볍게 쉬어요.",
          kind: "free",
        },
        {
          time: "17:30",
          title: first.name,
          detail:
            first.detail ||
            `${first.name}을(를) 가볍게 둘러보며 ${city} 분위기를 익혀요.`,
          kind: "activity",
        },
        {
          time: "19:30",
          title: `${city} 현지 저녁`,
          detail: styleSet.has("food")
            ? `${city}에서 현지인이 많이 찾는 맛집·야시장 쪽 첫 저녁을 먹어요.`
            : `${city} 숙소 근처 식당에서 부담 없이 저녁을 해결해요.`,
          kind: "food",
        },
      ],
    });
  }

  // Middle days — unique labels from real attractions
  for (let d = 1; d < daysNeeded - 1; d++) {
    const a1 = nextAttraction();
    const a2 = nextAttraction();
    const a3 = nextAttraction();

    days.push({
      label: themeLabel(d, a1, a2),
      items: [
        {
          time: "09:30",
          title: a1.name,
          detail:
            a1.detail ||
            `${a1.name}에서 오전을 보내요. 개장 직후가 사람이 덜해서 둘러보기 좋아요.`,
          kind: "activity",
        },
        {
          time: "12:30",
          title: `${shortName(a1.name, 10)} 근처 점심`,
          detail: `${a1.name} 인근 식당·카페에서 ${city} 현지 메뉴로 점심을 먹어요.`,
          kind: "food",
        },
        {
          time: "14:30",
          title: a2.name,
          detail:
            a2.detail ||
            `${a2.name}으로 이동해 오후 일정을 이어가요. 걷는 구간이 길면 편한 신발을 신어요.`,
          kind: "activity",
        },
        {
          time: "17:00",
          title: a3.name,
          detail:
            a3.detail ||
            `${a3.name}에서 해 지기 전까지 둘러보고, 근처에서 짧게 쉬어도 좋아요아요.`,
          kind: "activity",
        },
        {
          time: "19:00",
          title: `${city} 저녁 · ${shortName(a3.name, 8)} 인근`,
          detail: styleSet.has("hotplace")
            ? `${a3.name} 근처 핫플·야경 스팟에서 저녁을 먹고 사진도 남겨 보세요.`
            : `${a3.name} 인근에서 저녁을 먹고 ${city} 밤거리를 산책해요.`,
          kind: "food",
        },
      ],
    });
  }

  // Last day — departure
  if (daysNeeded > 1) {
    const last = nextAttraction();
    days.push({
      label: themeLabel(daysNeeded - 1, last),
      items: [
        {
          time: "09:30",
          title: "체크아웃 & 짐 보관",
          detail: "체크아웃 후 숙소나 역에 짐을 맡겨 두고 가볍게 다녀와요.",
          kind: "free",
        },
        {
          time: "11:00",
          title: last.name,
          detail:
            last.detail ||
            `${last.name}을(를) 마지막으로 둘러보고 기념품을 사도 좋아요.`,
          kind: "activity",
        },
        {
          time: "13:30",
          title: `${city} → 공항 · 역 이동`,
          detail: `${city}에서 ${origin}행 교통편에 맞춰 여유 있게 이동해요. 국제선은 최소 2시간 전 도착을 권장해요.`,
          kind: "transport",
        },
        {
          time: "16:00",
          title: `${origin} 행 출발`,
          detail: "탑승 수속·보안 검색을 마치고 귀가 일정으로 이어가요.",
          kind: "free",
        },
      ],
    });
  }

  return mapPoiDaysToSchedule(days.slice(0, daysNeeded), budgets);
}
