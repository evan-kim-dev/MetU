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
  flexibleMonth: number;
  styles: TravelStyle[];
}

export const INITIAL_FORM: OnboardingForm = {
  budget: "",
  people: 2,
  origin: "",
  destination: "",
  dateType: "specific",
  startDate: "",
  endDate: "",
  flexibleMonth: new Date().getMonth() + 1,
  styles: [],
};
