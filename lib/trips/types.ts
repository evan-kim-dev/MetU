export type TripStatus = "upcoming" | "ongoing" | "completed";

export interface TripExpense {
  id: string;
  category: string;
  label: string;
  amount: number;
  date: string;
}

export interface TripBudgetAllocation {
  id: string;
  label: string;
  amount: number;
  percent: number;
  color: string;
}

export interface TripScheduleItem {
  time: string;
  title: string;
  cost: number;
}

export interface TripDaySchedule {
  day: number;
  label: string;
  items: TripScheduleItem[];
  dayTotal: number;
}

export interface Trip {
  id: string;
  destination: string;
  country: string;
  origin: string;
  dateRange: string;
  dDay: number;
  budget: number;
  spent: number;
  people: number;
  styles: string[];
  imageUrl: string;
  memo?: string;
  expenses: TripExpense[];
  status: TripStatus;
  /** AI 추천 예산 분배 (저장 시 포함) */
  budgetAllocation?: TripBudgetAllocation[];
  /** AI 추천 일정표 (저장 시 포함) */
  dailySchedule?: TripDaySchedule[];
  tips?: string[];
}

export type TripUpdate = Partial<Omit<Trip, "id" | "expenses">> & {
  expenses?: TripExpense[];
};
