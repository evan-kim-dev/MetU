/** Synthetic fixtures only — VERIFY against real SMS; no real names/PANs. */

export const SYNTHETIC_SMS = {
  shinhanCreditOverseas: {
    label: "synthetic-shinhan-credit-overseas",
    text: "[Web발신] 신한(9xxx)해외승인 이*름 4.48달러 (US)01/10 09:18 WWW.AMAZON 누적1,234,567원",
  },
  shinhanCheckOverseas: {
    label: "synthetic-shinhan-check-overseas",
    text: "[Web발신] 신한체크해외승인 홍*동(****) 12/05 13:23 12,205 엔 (JP)LAWSON ENT",
  },
  samsungOverseas: {
    label: "synthetic-samsung-overseas",
    text: "삼성1111 해외승인 *** USD 0.10 02/08 15:57 AMAZON.COM LLC",
  },
  hyundaiUsd: {
    label: "synthetic-hyundai-usd",
    text: "[현대카드] 해외승인 홍*동님 12/11 17:48 USD 20.63 aliexpress",
  },
  hyundaiVnd: {
    label: "synthetic-hyundai-vnd",
    text: "[현대카드] 해외승인 홍*동님 01/08 23:21 VND 46,000.00 CNPHUQUOC-SHOP",
  },
  hanaDomestic: {
    label: "synthetic-hana-domestic",
    text: "하나1*3*승인 홍*동 1,390원 일시불 01/10 08:40 테스트가맹점 누적12,000원",
  },
  samsungDomestic: {
    label: "synthetic-samsung-domestic",
    text: "삼성1234승인 홍*동 33,900원 일시불 03/01 12:00 편의점",
  },
  wooriDomestic: {
    label: "synthetic-woori-domestic",
    text: "우리카드(****)승인 ***님 12,810원 일시불 04/02 18:30 카페",
  },
  hyundaiCancel: {
    label: "synthetic-hyundai-cancel",
    text: "[현대카드] 이*름님 12/22 KCP - 쿠팡 사용 4,930원 취소처리되었습니다",
  },
  demoHotelJpy: {
    label: "synthetic-demo-hotel-jpy",
    text: "신한(1234)해외승인 홍*동 45,000엔 (JP)HOTEL OSAKA NAMBA 11/03 21:40 누적2,345,678원",
  },
  dollarUnknown: {
    label: "synthetic-dollar-unknown",
    text: "신한(1234)해외승인 홍*동 10달러 AMAZON 01/05 10:00",
  },

  // --- P2: 발급사 확장 (VERIFY: 작성 시점 조사 기준 합성 예시. 실제 문자와 다를 수 있음) ---
  lotteDomestic: {
    label: "synthetic-lotte-domestic",
    text: "[Web발신] 롯데카드(1234) 승인 홍*동 12,500원 일시불 03/01 12:30 스타벅스 누적1,000,000원",
  },
  lotteInstallment: {
    label: "synthetic-lotte-installment",
    text: "[Web발신] 롯데카드(1234) 승인 홍*동 120,000원 3개월 03/02 14:05 전자랜드 누적1,120,000원",
  },
  lotteOverseas: {
    label: "synthetic-lotte-overseas",
    text: "[Web발신] 롯데카드(1234) 해외승인 홍*동 USD 12.34 03/03 09:15 AMAZON.COM",
  },
  lotteCancel: {
    label: "synthetic-lotte-cancel",
    text: "[Web발신] 롯데카드(1234) 승인취소 홍*동 12,500원 03/01 12:30 스타벅스",
  },
  lotteDollarUnknownCountry: {
    label: "synthetic-lotte-dollar-unknown-country",
    text: "[Web발신] 롯데카드(1234) 해외승인 홍*동 10달러 (JP) 03/03 09:15 SHOPX",
  },
  nhDomestic: {
    label: "synthetic-nh-domestic",
    text: "[Web발신] NH농협카드 1234 승인 홍*동 9,800원 일시불 03/02 09:10 GS25 누적500,000원",
  },
  nhOverseas: {
    label: "synthetic-nh-overseas",
    text: "[Web발신] NH농협카드 1234 해외승인 홍*동 12,205엔 (JP) 03/02 09:10 LAWSON",
  },
  nhCancel: {
    label: "synthetic-nh-cancel",
    text: "[Web발신] NH농협카드 1234 승인취소 홍*동 9,800원 03/02 09:10 GS25",
  },
  bcDomestic: {
    label: "synthetic-bc-domestic",
    text: "[Web발신] BC카드(1234)승인 홍*동 4,500원 일시불 03/03 18:20 파리바게뜨 누적300,000원",
  },
  bcOverseas: {
    label: "synthetic-bc-overseas",
    text: "[Web발신] BC카드(1234)해외승인 홍*동 4.48달러 (US) 03/03 18:20 WWW.AMAZON",
  },
  bcCancel: {
    label: "synthetic-bc-cancel",
    text: "[Web발신] BC카드(1234)승인취소 홍*동 4,500원 03/03 18:20 파리바게뜨",
  },
  kakaobankDomestic: {
    label: "synthetic-kakaobank-domestic",
    text: "[Web발신] 카카오뱅크 체크카드 승인 홍*동 3,200원 03/04 07:50 CU편의점",
  },
  kakaobankOverseas: {
    label: "synthetic-kakaobank-overseas",
    text: "[Web발신] 카카오뱅크 체크카드 해외승인 홍*동 VND 46,000.00 03/04 07:50 CNPHUQUOC-SHOP",
  },
  kakaobankCancel: {
    label: "synthetic-kakaobank-cancel",
    text: "[Web발신] 카카오뱅크 체크카드 승인취소 홍*동 3,200원 03/04 07:50 CU편의점",
  },
  tossbankDomestic: {
    label: "synthetic-tossbank-domestic",
    text: "[Web발신] 토스뱅크 체크카드 승인 홍*동 5,500원 03/05 20:15 배달의민족",
  },
  tossbankOverseas: {
    label: "synthetic-tossbank-overseas",
    text: "[Web발신] 토스뱅크 체크카드 해외승인 홍*동 12.50달러 (SG) 03/05 20:15 GRAB",
  },
  tossbankCancel: {
    label: "synthetic-tossbank-cancel",
    text: "[Web발신] 토스뱅크 체크카드 승인취소 홍*동 5,500원 03/05 20:15 배달의민족",
  },
  kbDomestic: {
    label: "synthetic-kb-domestic",
    text: "[Web발신] [KB국민카드] 승인 홍*동 2,300원 일시불 03/07 12:00 이마트24 누적800,000원",
  },
  kbOverseas: {
    label: "synthetic-kb-overseas",
    text: "[Web발신] [KB국민카드] 해외승인 홍*동 JPY 3,500 03/07 12:00 DONKI",
  },
  kbCancel: {
    label: "synthetic-kb-cancel",
    text: "[Web발신] [KB국민카드] 승인취소 홍*동 2,300원 03/07 12:00 이마트24",
  },
  hyundaiDomestic: {
    label: "synthetic-hyundai-domestic",
    text: "[현대카드] 승인 홍*동님 8,900원 일시불 03/06 11:00 올리브영 누적700,000원",
  },
  hyundaiInstallment: {
    label: "synthetic-hyundai-installment",
    text: "[현대카드] 승인 홍*동님 240,000원 6개월 03/06 15:20 하이마트",
  },

  // --- 비승인 문자 (파싱되면 안 됨) ---
  negativeOtp: {
    label: "synthetic-negative-otp",
    text: "[Web발신] [신한카드] 인증번호 [123456]를 입력해 주세요. 승인 요청 3분 내 입력",
  },
  negativeAd: {
    label: "synthetic-negative-ad",
    text: "[Web발신] (광고) 롯데카드 해외결제 승인 이벤트 최대 50,000원 캐시백 무료수신거부 080-000-0000",
  },
  negativeDeposit: {
    label: "synthetic-negative-deposit",
    text: "[Web발신] 토스뱅크 입금 50,000원 홍*동 03/05 20:15 잔액 100,000원",
  },
  negativeTransferApproval: {
    label: "synthetic-negative-transfer-approval",
    text: "[Web발신] 카카오뱅크 이체 승인 홍*동 30,000원 03/04 07:50",
  },
  negativeCumulativeOnly: {
    label: "synthetic-negative-cumulative-only",
    text: "[Web발신] 누적1,234,567원",
  },
} as const;
