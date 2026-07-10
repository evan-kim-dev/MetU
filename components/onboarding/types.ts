export type DateType = "specific" | "flexible";

export type TravelStyle =
  | "healing"
  | "sightseeing"
  | "food"
  | "shopping"
  | "activity"
  | "culture"
  | "nature"
  | "hotplace"
  | "shopping-mall";

export interface OnboardingForm {
  budget: string;
  people: number;
  origin: string;
  destination: string;
  dateType: DateType;
  startDate: string;
  endDate: string;
  flexibleYear: number;
  flexibleMonth: number;
  styles: TravelStyle[];
}

export function getFlexibleYearOptions(): number[] {
  const year = new Date().getFullYear();
  return [year, year + 1, year + 2];
}

export function normalizeFlexibleYear(year: unknown): number {
  const current = new Date().getFullYear();
  const options = getFlexibleYearOptions();
  if (typeof year !== "number" || !Number.isFinite(year)) return current;
  if (year < options[0] || year > options[options.length - 1]) return current;
  return year;
}

export function isFlexibleScheduleValid(month: number, year: number): boolean {
  if (month < 1 || month > 12) return false;
  const normalizedYear = normalizeFlexibleYear(year);
  const now = new Date();
  if (normalizedYear === now.getFullYear() && month < now.getMonth() + 1) {
    return false;
  }
  return true;
}

export const INITIAL_FORM: OnboardingForm = {
  budget: "",
  people: 2,
  origin: "",
  destination: "",
  dateType: "specific",
  startDate: "",
  endDate: "",
  flexibleYear: new Date().getFullYear(),
  flexibleMonth: new Date().getMonth() + 1,
  styles: [],
};
