import type { OnboardingForm } from "@/components/onboarding/types";

export interface BudgetAllocation {
  id: string;
  label: string;
  amount: number;
  percent: number;
  color: string;
}

export interface FlightPlan {
  airline: string;
  route: string;
  schedule: string;
  price: number;
  note: string;
}

export interface HotelPlan {
  name: string;
  area: string;
  nights: number;
  pricePerNight: number;
  total: number;
  note: string;
}

export interface DaySchedule {
  day: number;
  label: string;
  items: { time: string; title: string; cost: number }[];
  dayTotal: number;
}

export interface TripRecommendation {
  id: string;
  form: OnboardingForm;
  destination: string;
  country: string;
  origin: string;
  people: number;
  totalBudget: number;
  dateRange: string;
  nights: number;
  summary: string;
  /** 예산·목적지 불일치 시 팩트폭격 톤 */
  summaryTone?: "normal" | "factbomb";
  imageUrl: string;
  styleLabels: string[];
  budgetAllocation: BudgetAllocation[];
  flight: FlightPlan;
  hotel: HotelPlan;
  dailySchedule: DaySchedule[];
  tips: string[];
  /** 실제 참고한 RAG 출처 */
  ragSources: RagSource[];
}

export interface RagSource {
  id: string;
  category: string;
  title: string;
  content: string;
}
