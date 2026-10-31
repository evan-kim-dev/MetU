import type { ScheduleItemPlaceFields } from "@/lib/places/types";

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

export interface TripScheduleItem extends ScheduleItemPlaceFields {
  time: string;
  /** 소제목 (예: 지하철 → 오테마치역) */
  title: string;
  /** 상세 내용 (예: 역에서 황거동 어원 입구로 이동) */
  detail?: string;
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
  /** 확정된 출발일 (YYYY-MM-DD). 없으면 dateRange 에서 추정한다. */
  startDate?: string | null;
  /** 확정된 종료일 (YYYY-MM-DD). */
  endDate?: string | null;
  /**
   * 내가 만든 여행이면 true, 초대로 합류한 여행이면 false.
   * 값이 없으면(로컬/게스트 여행) 소유자로 본다. 수정·삭제·초대·정산 생성은 소유자만 한다.
   */
  isOwner?: boolean;
}

export type TripUpdate = Partial<Omit<Trip, "id" | "expenses" | "isOwner">> & {
  expenses?: TripExpense[];
};
