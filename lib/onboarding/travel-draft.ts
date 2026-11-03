import {
  INITIAL_FORM,
  normalizeFlexibleYear,
  type DateType,
  type OnboardingForm,
  type TravelStyle,
} from "@/lib/onboarding/types";

export const TRAVEL_DRAFT_KEY = "metu.onboarding.draft.v1";

export type TravelDraft = {
  step: number;
  form: OnboardingForm;
};

const STYLES = new Set<TravelStyle>([
  "healing",
  "sightseeing",
  "food",
  "shopping",
  "activity",
  "culture",
  "nature",
  "hotplace",
  "shopping-mall",
]);

function isDateType(value: unknown): value is DateType {
  return value === "specific" || value === "flexible";
}

function parseStyles(value: unknown): TravelStyle[] {
  if (!Array.isArray(value)) return [];
  const out: TravelStyle[] = [];
  for (const item of value) {
    if (typeof item === "string" && STYLES.has(item as TravelStyle)) {
      out.push(item as TravelStyle);
    }
  }
  return out;
}

function parseForm(value: unknown): OnboardingForm | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.budget !== "string") return null;
  if (typeof v.people !== "number" || !Number.isFinite(v.people) || v.people < 1) {
    return null;
  }
  if (typeof v.origin !== "string" || typeof v.destination !== "string") {
    return null;
  }
  if (!isDateType(v.dateType)) return null;
  if (typeof v.startDate !== "string" || typeof v.endDate !== "string") {
    return null;
  }
  if (typeof v.flexibleMonth !== "number" || !Number.isFinite(v.flexibleMonth)) {
    return null;
  }
  return {
    budget: v.budget,
    people: Math.min(20, Math.max(1, Math.floor(v.people))),
    origin: v.origin,
    destination: v.destination,
    dateType: v.dateType,
    startDate: v.startDate,
    endDate: v.endDate,
    flexibleYear: normalizeFlexibleYear(v.flexibleYear),
    flexibleMonth: Math.min(12, Math.max(1, Math.floor(v.flexibleMonth))),
    styles: parseStyles(v.styles),
  };
}

/** sessionStorage 에 저장된 여행 온보딩 초안을 읽어요. 깨진 값은 버려요. */
export function loadTravelDraft(): TravelDraft | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(TRAVEL_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const v = parsed as Record<string, unknown>;
    if (typeof v.step !== "number" || !Number.isFinite(v.step)) return null;
    const step = Math.min(4, Math.max(1, Math.floor(v.step)));
    const form = parseForm(v.form);
    if (!form) return null;
    return { step, form };
  } catch {
    return null;
  }
}

export function saveTravelDraft(draft: TravelDraft): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    const step = Math.min(4, Math.max(1, Math.floor(draft.step)));
    sessionStorage.setItem(
      TRAVEL_DRAFT_KEY,
      JSON.stringify({ step, form: draft.form })
    );
  } catch {
    // quota / private mode — 복원 실패는 허용
  }
}

export function clearTravelDraft(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(TRAVEL_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function emptyTravelDraft(): TravelDraft {
  return { step: 1, form: { ...INITIAL_FORM } };
}
