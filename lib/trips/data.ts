import type { Trip } from "./types";

export const INITIAL_TRIPS: Trip[] = [
  {
    id: "trip-london",
    destination: "런던",
    country: "영국",
    origin: "서울",
    dateRange: "8월 12일 - 8월 18일",
    dDay: 35,
    budget: 2400000,
    spent: 860000,
    people: 2,
    styles: ["sightseeing", "culture", "food"],
    imageUrl:
      "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
    memo: "대영박물관, 코벤트 가든, 노팅힐 마켓 방문 예정",
    status: "upcoming",
    expenses: [
      {
        id: "exp-1",
        category: "교통",
        label: "항공권 (왕복)",
        amount: 450000,
        date: "7월 1일",
      },
      {
        id: "exp-2",
        category: "숙소",
        label: "호텔 6박",
        amount: 280000,
        date: "7월 5일",
      },
      {
        id: "exp-3",
        category: "식비",
        label: "레스토랑 예약금",
        amount: 80000,
        date: "7월 10일",
      },
      {
        id: "exp-4",
        category: "교통",
        label: "오이스터 카드 충전",
        amount: 50000,
        date: "7월 15일",
      },
    ],
  },
  {
    id: "trip-osaka",
    destination: "오사카",
    country: "일본",
    origin: "서울",
    dateRange: "5월 3일 - 5월 7일",
    dDay: 0,
    budget: 1200000,
    spent: 1180000,
    people: 2,
    styles: ["food", "shopping", "hotplace"],
    imageUrl:
      "https://images.unsplash.com/photo-1590559899731-a382839e5549?auto=format&fit=crop&w=800&q=80",
    memo: "도톤보리, 유니버설 스튜디오 재팬",
    status: "completed",
    expenses: [
      {
        id: "exp-5",
        category: "교통",
        label: "항공권",
        amount: 320000,
        date: "4월 1일",
      },
      {
        id: "exp-6",
        category: "숙소",
        label: "호텔 4박",
        amount: 480000,
        date: "4월 5일",
      },
      {
        id: "exp-7",
        category: "식비",
        label: "현지 식비",
        amount: 280000,
        date: "5월 7일",
      },
      {
        id: "exp-8",
        category: "쇼핑",
        label: "면세·기념품",
        amount: 100000,
        date: "5월 7일",
      },
    ],
  },
];

export const STYLE_LABELS: Record<string, string> = {
  healing: "힐링",
  sightseeing: "관광",
  food: "맛집",
  shopping: "쇼핑",
  activity: "액티비티",
  culture: "문화·예술",
  nature: "자연",
  hotplace: "핫플",
};
