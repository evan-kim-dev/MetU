import { notFound } from "next/navigation";
import { CardBenefitLab } from "@/components/cards/CardBenefitLab";

export const metadata = { title: "카드 혜택 계획 테스트 · MetU", robots: { index: false } };

/**
 * 임시 테스트 화면 — 카드 혜택(CODEF 실적조회) 기반 여행 결제 계획.
 * 개발 환경에서만 열려요. 배포 환경에서는 NEXT_PUBLIC_CARD_LAB=1 일 때만 보여요.
 */
export default function CardBenefitsLabPage() {
  const enabled =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_CARD_LAB === "1";
  if (!enabled) notFound();
  return <CardBenefitLab />;
}
