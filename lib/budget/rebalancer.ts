export interface RebalanceItem {
  id: string;
  name: string;
  category: "meal" | "cafe" | "activity" | "spot";
  costKRW: number;
  /** 고정된 장소면 감축하지 않아요 */
  isFixed?: boolean;
}

export interface RebalanceResult {
  adjustedItems: RebalanceItem[];
  originalTotal: number;
  newTotal: number;
  savedAmount: number;
  adjustmentsLog: string[];
}

/**
 * 항공·숙소를 제외한 현지 가용 목표 예산에 맞춰
 * 식비·카페 등 유동 항목 가격 티어를 감축해요 (고정 항목·스팟은 유지).
 * 금액은 정수 KRW.
 */
export function rebalanceScheduleBudget(
  items: RebalanceItem[],
  targetDiscretionaryBudget: number
): RebalanceResult {
  const target = Math.max(0, Math.floor(targetDiscretionaryBudget));
  const originalTotal = items.reduce(
    (sum, item) => sum + Math.max(0, Math.floor(item.costKRW)),
    0
  );
  let diff = originalTotal - target;

  const adjustedItems = items.map((i) => ({
    ...i,
    costKRW: Math.max(0, Math.floor(i.costKRW)),
  }));
  const adjustmentsLog: string[] = [];

  if (diff <= 0) {
    return {
      adjustedItems,
      originalTotal,
      newTotal: originalTotal,
      savedAmount: 0,
      adjustmentsLog: ["현재 예산 범위 내에 있습니다."],
    };
  }

  // 1차: 식비 → 카페 → 액티비티 티어 감축 (항목당 최대 40%/30%/25%)
  for (const item of adjustedItems) {
    if (diff <= 0) break;
    if (item.isFixed) continue;

    if (item.category === "meal" && item.costKRW > 25_000) {
      const cut = Math.min(diff, Math.floor(item.costKRW * 0.4));
      if (cut <= 0) continue;
      item.costKRW -= cut;
      diff -= cut;
      adjustmentsLog.push(
        `${item.name}: 로컬 가성비 메뉴로 조정 (-₩${cut.toLocaleString("ko-KR")})`
      );
    } else if (item.category === "cafe" && item.costKRW > 10_000) {
      const cut = Math.min(diff, Math.floor(item.costKRW * 0.3));
      if (cut <= 0) continue;
      item.costKRW -= cut;
      diff -= cut;
      adjustmentsLog.push(
        `${item.name}: 간식 비용 효율화 (-₩${cut.toLocaleString("ko-KR")})`
      );
    } else if (item.category === "activity" && item.costKRW > 20_000) {
      const cut = Math.min(diff, Math.floor(item.costKRW * 0.25));
      if (cut <= 0) continue;
      item.costKRW -= cut;
      diff -= cut;
      adjustmentsLog.push(
        `${item.name}: 액티비티 티어 조정 (-₩${cut.toLocaleString("ko-KR")})`
      );
    }
  }

  // 2차: 티어 감축 후에도 남으면 비고정 항목을 비율로 추가 수렴
  if (diff > 0) {
    const flexible = adjustedItems.filter((i) => !i.isFixed && i.costKRW > 0);
    const flexSum = flexible.reduce((s, i) => s + i.costKRW, 0);
    if (flexSum > 0) {
      let remaining = diff;
      for (let i = 0; i < flexible.length; i += 1) {
        const item = flexible[i]!;
        const isLast = i === flexible.length - 1;
        const proportional = Math.floor((item.costKRW / flexSum) * diff);
        const cut = Math.min(
          item.costKRW,
          isLast ? remaining : Math.min(remaining, proportional)
        );
        if (cut <= 0) continue;
        item.costKRW -= cut;
        remaining -= cut;
        adjustmentsLog.push(
          `${item.name}: 예산 상한 맞춤 (-₩${cut.toLocaleString("ko-KR")})`
        );
      }
      diff = remaining;
    }
  }

  const newTotal = adjustedItems.reduce((sum, item) => sum + item.costKRW, 0);

  return {
    adjustedItems,
    originalTotal,
    newTotal,
    savedAmount: originalTotal - newTotal,
    adjustmentsLog:
      adjustmentsLog.length > 0
        ? adjustmentsLog
        : ["감축할 유동 항목이 없어 예산을 맞추지 못했어요."],
  };
}

/** PlaceKind / 제목 휴리스틱 → 리밸런스 카테고리 */
export function classifyRebalanceCategory(
  kind: string | undefined,
  title: string
): RebalanceItem["category"] {
  const k = (kind ?? "").toLowerCase();
  if (k === "food" || k === "meal") return "meal";
  if (k === "cafe") return "cafe";
  if (k === "attraction" || k === "spot") return "spot";
  if (k === "shopping" || k === "activity") return "activity";

  const t = title.toLowerCase();
  if (/카페|cafe|커피|디저트/.test(t)) return "cafe";
  if (/식|밥|라멘|스시|맛집|점심|저녁|아침|meal|food/.test(t)) return "meal";
  if (/투어|체험|액티비티|쇼핑/.test(t)) return "activity";
  return "spot";
}
