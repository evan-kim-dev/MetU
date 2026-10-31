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

/** AI·동적 POI 모두 실패했을 때 tips에 넣는 재시도 안내 */
export const SCHEDULE_RETRY_TIP =
  "AI 일정 생성을 실패했어요. 다시 시도해 주세요.";

function costFor(
  kind: PoiItem["kind"],
  budgets: { food: number; activity: number; transport: number }
): number {
  if (kind === "free") return 0;
  if (kind === "food") return budgets.food;
  if (kind === "transport") return budgets.transport;
  return budgets.activity;
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

/**
 * 숙소·교통만 담은 최소 일정 (동적 POI·Places 모두 비었을 때).
 */
export function buildMinimalLodgingTransportSchedule(
  city: string,
  origin: string,
  nights: number,
  budgets: { food: number; activity: number; transport: number }
): DaySchedule[] {
  const daysNeeded = Math.max(1, nights + 1);
  const days: PoiDay[] = [];

  days.push({
    label: `${city} 숙소 · 교통`,
    items: [
      {
        time: "14:00",
        title: `${city} 도착 · 시내 이동`,
        detail: `${origin}에서 도착한 뒤 대중교통·택시로 시내로 이동해요.`,
        kind: "transport",
      },
      {
        time: "16:00",
        title: "숙소 체크인",
        detail: "관광 스팟 일정은 AI가 다시 만들 수 있어요. 우선 숙소부터 잡아 두어요.",
        kind: "free",
      },
      {
        time: "19:00",
        title: "숙소 근처 저녁",
        detail: `${city} 숙소 인근에서 가볍게 저녁을 해결해요.`,
        kind: "food",
      },
    ],
  });

  for (let d = 1; d < daysNeeded - 1; d++) {
    days.push({
      label: `${city} 최소 일정`,
      items: [
        {
          time: "10:00",
          title: "숙소 휴식 · 자유 시간",
          detail: "상세 관광 일정을 다시 생성해 주세요.",
          kind: "free",
        },
        {
          time: "12:30",
          title: "숙소 근처 식사",
          detail: `${city} 근처에서 끼니를 해결해요.`,
          kind: "food",
        },
        {
          time: "18:30",
          title: "숙소 귀환",
          detail: "저녁은 숙소 주변에서 여유롭게 보내요.",
          kind: "free",
        },
      ],
    });
  }

  if (daysNeeded > 1) {
    days.push({
      label: `${city} 출발 · 교통`,
      items: [
        {
          time: "10:00",
          title: "체크아웃",
          detail: "숙소 체크아웃 후 공항·역으로 이동할 준비를 해요.",
          kind: "free",
        },
        {
          time: "12:00",
          title: `${city} → 공항 · 역 이동`,
          detail: `${origin}행에 맞춰 여유 있게 이동해요.`,
          kind: "transport",
        },
        {
          time: "15:00",
          title: `${origin} 행 출발`,
          detail: "탑승 수속을 마치고 귀국 일정으로 이어가요.",
          kind: "free",
        },
      ],
    });
  }

  return mapPoiDaysToSchedule(days.slice(0, daysNeeded), budgets);
}

export function isMinimalScheduleFallback(days: DaySchedule[]): boolean {
  return days.some(
    (d) =>
      d.label.includes("숙소 · 교통") || d.label.includes("최소 일정")
  );
}

/**
 * 웹에서 가져온 attractions로 실명·상세 일정을 만든다.
 * (destination-knowledge Open-Meteo+Wikipedia+Overpass 결과 전용 폴백)
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
            `${a3.name}에서 해 지기 전까지 둘러보고, 근처에서 짧게 쉬어도 좋아요.`,
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
