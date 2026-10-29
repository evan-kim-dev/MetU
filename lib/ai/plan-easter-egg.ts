/** Client-safe easter-egg destination checks (no server AI imports). */

const EASTER_EGG_DESTINATIONS: Array<{ keys: string[]; message: string }> = [
  {
    keys: ["달", "moon", "lunar"],
    message:
      "달이요? 저비용 항공이 달까지 안 가요. 지갑부터 지구에 착륙시키세요.",
  },
  {
    keys: ["화성", "mars"],
    message:
      "화성 왕복은 아직 오픈런도 없어요. 일단 지구에서 예산부터 살려 보세요.",
  },
  {
    keys: ["아틀란티스", "atlantis"],
    message:
      "아틀란티스요? 수중 리조트도 예약 불가야요. 가라앉은 건 도시가 아니라 당신의 현실감각이에요.",
  },
  {
    keys: ["나니아", "narnia"],
    message:
      "나니아는 옷장 환승만 가능해요. Met U 검색창에 판타지 소설 제목 넣지 마세요.",
  },
  {
    keys: ["호그와트", "hogwarts"],
    message:
      "호그와트행은 9¾ 승강장이에요. 인천엔 안내 방송 없고, 당신 예산엔 마법도 없어요.",
  },
  {
    keys: ["남극", "antarctica", "antarctic"],
    message:
      "남극은 펭귄 미팅비가 당신 총예산보다 비싸요. 덜 추한 현실부터 가요.",
  },
  {
    keys: ["북극", "arctic", "북극점"],
    message:
      "북극은 산타 특송만 열려 있어요. 일반석 매진이고, 당신 예산도 매진이에요.",
  },
  {
    keys: ["꿈나라", "꿈 속", "드림랜드"],
    message:
      "꿈나라는 체크인이 잠들기예요. 깨면 일정표랑 잔고가 같이 사라져요. 현실 도시로요.",
  },
  {
    keys: ["내 방", "우리 집", "집콕", "안방"],
    message:
      "내 방은 이미 체크인 완료예요. 여행 앱 켜놓고 안방 가는 거, 그거 메타 유머예요.",
  },
];

function normalizeEasterText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchEasterEggDestination(
  destination: string,
  country: string
): string | null {
  const text = normalizeEasterText(`${destination} ${country}`);
  if (!text) return null;

  for (const egg of EASTER_EGG_DESTINATIONS) {
    const hit = egg.keys.some((key) => {
      const k = normalizeEasterText(key);
      if (!k) return false;
      if (k.length <= 2) {
        return text.split(/[\s,·/\-]+/).some((token) => token === k);
      }
      return text.includes(k);
    });
    if (hit) return egg.message;
  }
  return null;
}

export function isEasterEggDestination(
  destination: string,
  country = ""
): boolean {
  return matchEasterEggDestination(destination, country) !== null;
}

export function planHasEasterEgg(plan: {
  destination: string;
  country?: string;
  form?: { destination?: string };
}): boolean {
  if (isEasterEggDestination(plan.destination, plan.country ?? "")) {
    return true;
  }
  const typed = plan.form?.destination?.trim();
  return Boolean(typed && isEasterEggDestination(typed, ""));
}
