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
} as const;
