import { z } from "zod";

/**
 * CODEF 개인카드 실적조회(result-check-list) 출력부.
 * 문서: https://developer.codef.io/products/card/common/p/result-check
 * 단건이면 객체, 다건이면 배열로 와요. 대부분 필드가 선택(△)이라 모두 optional.
 */
const str = z.string().optional().nullable();

export const CodefPerformanceSchema = z.object({
  resCurrentUseAmt: str,
  resRequiredPerformanceAmt: str,
  commStartDate: str,
  commEndDate: str,
  resCoverageCriteria: str,
  resMeetPerformanceYN: str,
  resStandardUseAmt: str,
});

export const CodefBenefitDetailSchema = z.object({
  resCardBenefitName: str,
  resPerformanceConditions: str,
  resBusinessTypes: str,
});

export const CodefBenefitSchema = z.object({
  resType: str,
  resCardBenefitName: str,
  resBusinessTypes: str,
  resDetailList: z.array(CodefBenefitDetailSchema).optional().nullable(),
  resCardPerformanceList: z.array(CodefPerformanceSchema).optional().nullable(),
});

export const CodefCardSchema = z.object({
  resCardName: z.string(),
  resCardNo: str,
  resCardType: str,
  resCardCompany: str,
  resLnkUrl: str,
  resCardBenefitList: z.array(CodefBenefitSchema).optional().nullable(),
});

export type CodefCard = z.infer<typeof CodefCardSchema>;
export type CodefBenefit = z.infer<typeof CodefBenefitSchema>;

export const CodefEnvelopeSchema = z.object({
  result: z.object({
    code: z.string(),
    message: z.string().optional().nullable(),
  }),
  data: z.unknown(),
});

/** data 를 카드 배열로 맞춰요 (객체 1건 → [객체]). */
export function toCardList(data: unknown): CodefCard[] {
  const list = Array.isArray(data) ? data : data ? [data] : [];
  const out: CodefCard[] = [];
  for (const item of list) {
    const parsed = CodefCardSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
