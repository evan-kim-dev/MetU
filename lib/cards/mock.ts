/**
 * 예시 데이터 — CODEF 실적조회 응답 형식 그대로의 가상 카드 3장.
 * 실제 카드 상품·카드사가 아니에요. CODEF 키가 없을 때 화면·계산을 시험하는 용도예요.
 */
export const DEMO_CODEF_DATA = [
  {
    resCardName: "트래블 체크카드 (예시)",
    resCardNo: "6012345678901111",
    resCardType: "본인",
    resCardCompany: "예시카드",
    resLnkUrl: "",
    resCardBenefitList: [
      {
        resType: "청구할인",
        resCardBenefitName: "[해외결제]해외 가맹점 2% 청구할인",
        resBusinessTypes: "해외가맹점",
        resDetailList: [
          {
            resCardBenefitName: "해외 가맹점 이용금액 2% 청구할인",
            resPerformanceConditions: "전월 실적 30만원 이상, 월 최대 2만원",
            resBusinessTypes: "해외가맹점",
          },
        ],
        resCardPerformanceList: [
          {
            resCurrentUseAmt: "320000",
            resRequiredPerformanceAmt: "0",
            commStartDate: "20261101",
            commEndDate: "20261130",
            resCoverageCriteria: "전월 이용금액 기준",
            resMeetPerformanceYN: "1",
            resStandardUseAmt: "300000",
          },
        ],
      },
      {
        resType: "청구할인",
        resCardBenefitName: "[교통]대중교통 10% 청구할인",
        resBusinessTypes: "대중교통",
        resDetailList: [
          {
            resCardBenefitName: "버스·지하철 10% 청구할인",
            resPerformanceConditions: "월 최대 5,000원",
            resBusinessTypes: "대중교통",
          },
        ],
        resCardPerformanceList: [],
      },
    ],
  },
  {
    resCardName: "라이프 신용카드 (예시)",
    resCardNo: "4512345678902222",
    resCardType: "본인",
    resCardCompany: "예시카드",
    resLnkUrl: "",
    resCardBenefitList: [
      {
        resType: "청구할인",
        resCardBenefitName: "[항공]항공권 5% 청구할인",
        resBusinessTypes: "항공",
        resDetailList: [
          {
            resCardBenefitName: "항공권 결제 5% 청구할인",
            resPerformanceConditions: "전월 실적 30만원 이상, 월 최대 3만원",
            resBusinessTypes: "항공",
          },
        ],
        resCardPerformanceList: [
          {
            resCurrentUseAmt: "180000",
            resRequiredPerformanceAmt: "120000",
            commStartDate: "20261101",
            commEndDate: "20261130",
            resCoverageCriteria: "전월 이용금액 기준",
            resMeetPerformanceYN: "0",
            resStandardUseAmt: "300000",
          },
        ],
      },
      {
        resType: "청구할인",
        resCardBenefitName: "[숙박]호텔·숙박 예약 7% 청구할인",
        resBusinessTypes: "숙박",
        resDetailList: [
          {
            resCardBenefitName: "호텔 예약 사이트 7% 청구할인",
            resPerformanceConditions: "월 최대 2만원",
            resBusinessTypes: "숙박",
          },
        ],
        resCardPerformanceList: [],
      },
      {
        resType: "청구할인",
        resCardBenefitName: "[음식점]음식점 10% 청구할인",
        resBusinessTypes: "음식점",
        resDetailList: [
          {
            resCardBenefitName: "음식점 업종 10% 청구할인",
            resPerformanceConditions: "월 최대 1만원",
            resBusinessTypes: "음식점",
          },
        ],
        resCardPerformanceList: [],
      },
    ],
  },
  {
    resCardName: "커피 체크카드 (예시)",
    resCardNo: "6012345678903333",
    resCardType: "본인",
    resCardCompany: "예시카드",
    resLnkUrl: "",
    resCardBenefitList: [
      {
        resType: "할인",
        resCardBenefitName: "[음료할인]커피전문점 3,000원 할인",
        resBusinessTypes: "음료할인",
        resDetailList: [
          {
            resCardBenefitName: "커피전문점 건당 3,000원 할인",
            resPerformanceConditions: "",
            resBusinessTypes: "카페",
          },
        ],
        resCardPerformanceList: [
          {
            resCurrentUseAmt: "250000",
            resRequiredPerformanceAmt: "0",
            commStartDate: "20261101",
            commEndDate: "20261130",
            resCoverageCriteria: "",
            resMeetPerformanceYN: "1",
            resStandardUseAmt: "200000",
          },
        ],
      },
      {
        resType: "적립",
        resCardBenefitName: "[기타]제휴처 포인트 적립",
        resBusinessTypes: "",
        resDetailList: [],
        resCardPerformanceList: [],
      },
    ],
  },
] as const;
