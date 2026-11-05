# [PRD] MetU: 제로 입력 여행 정산 & 예산 기반 여행 기획 에이전트
Product Requirements Document (제품 요구사항 명세서) v1.0

- 작성일: 2026년 11월 6일
- 작성자: MetU 프로덕트 팀 (Evan Kim 외)
- 대상 플랫폼: Web (Mobile-First PWA, Desktop Responsive)
- 기술 스택: Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (Auth, DB, RLS, Storage), Vercel

---

## 1. 제품 개요 (Product Overview)

### 1.1 제품 정의
**MetU(멧유)**는 여행지에서 여러 명이 함께 쓴 돈을 입력 없이 자동으로 기록·정산하고, 사용자의 총 예산 한도 내에서 최적의 여행 코스와 동선을 설계해 주는 지능형 여행 금융 코파일럿입니다.

### 1.2 비전 (Vision)
> "돈 계산과 정산의 어색함을 지우고, 함께하는 여행의 즐거움만 남긴다."
- 여행 중 누구도 영수증을 모으거나 가계부 앱에 타이핑하지 않습니다.
- 처음 만난 동행(밍글링 투어, 소셜 트립)이든 가까운 친구든, 돈 이야기를 꺼내는 불편함 없이 3초 만에 각자의 몫을 확인하고 송금합니다.
- 예산이 정해지면 AI가 항공·숙박·식비·동선을 예산 상한선(Ceiling) 안에서 실시간으로 맞춰줍니다.

---

## 2. 타겟 고객 및 핵심 문제 (Target & Problem)

### 2.1 타겟 고객 (Target Audience)
1. Primary: 2030 소셜·밍글링 투어 여행자 (처음 만난 사람들과 식사/액티비티 후 정산이 필요한 동행)
2. Secondary: 2~4인 소규모 자유여행 그룹 (친구, 연인, 가족 단위 해외/국내 여행)
3. B2B 연계: 패키지/소셜 투어 운영사 (자유시간 공용 경비 취합 및 정산 자동화 솔루션)

### 2.2 해결하려는 핵심 문제 (Pain Points)

| 구분 | 기존 여행의 문제점 (Pain Points) | MetU의 해결책 (Solutions) |
| :--- | :--- | :--- |
| 기획 단계 | 예산에 맞는 현실적인 일정을 짜기 어려움. 장소를 바꾸면 총예산이 깨지고 동선이 꼬임 | 스마트 예산 리밸런서 & 지오 최단동선으로 예산 상한선 내 POI 및 이동 시간 자동 최적화 |
| 여행 중 | 아무도 지출을 제때 입력하지 않음. 영수증 분실 및 해외 카드 청구액 불일치 | 결제 문자/영수증 자동 파싱(OCR) 및 DCC 바가지 경고·실청구 환율 버퍼(+2.5%) |
| 정산 단계 | 마지막 날 총무가 정산표를 만들어 돈 달라고 독촉해야 하는 어색함 | 앱 설치 없는 게스트 QR 링크(`/s/[token]`) + "술 제외" 분담 토글 + 토스 1초 딥링크 송금 |

---

## 3. 핵심 기능 요구사항 (Functional Requirements)

### 3.1 [P0] 무가입 게스트 정산 & 1초 송금 (Zero-Install Guest Settlement)
- FR-01 (게스트 웹 뷰): 동행자는 앱 설치나 회원가입 없이, 호스트가 공유한 QR 코드나 링크(`/s/[token]`)를 통해 브라우저에서 3초 만에 정산 내역에 접속할 수 있어야 한다.
- FR-02 (예외 분담 토글): "저는 술 안 마셨어요", "특정 메뉴 제외" 등 품목별 분담 여부를 원클릭으로 토글할 수 있어야 하며, 토글 즉시 순수 계산 함수(`calculateSplit`)를 통해 본인 부담액이 실시간 재계산되어야 한다.
- FR-03 (토스 1초 딥링크 송금): 모바일 접속 시 `supertoss://send?bank={은행}&accountNo={계좌}&amount={금액}` 스킴을 호출해 받는 사람과 금액이 자동 입력된 토스 송금 화면을 즉시 띄운다. PC나 토스 미설치 환경에서는 클립보드 복사 폴백과 Toast 안내를 제공한다.
- FR-04 (게스트 쓰기 차단): 게스트 세션은 본인 분담 조정 외에 호스트의 지출 내역 삭제, 결제자 변경, 계좌 변조 등의 권한이 없으며, 비인가 쓰기 시도시 403 `guest-readonly`로 방어한다.

### 3.2 [P0] 예산 기반 여행 기획 & 스마트 리밸런서 (Budget-Driven Trip Planning)
- FR-05 (1초 데모 직행 고속도로): 홈 화면 배너 및 추천 여행지 카드 클릭 시, 4단계 온보딩을 거치지 않고 완성형 100만원 예산 플랜(`/onboarding/result?sample=tokyo`)으로 0.5초 만에 진입할 수 있어야 한다.
- FR-06 (스마트 예산 리밸런서): 결과 화면에서 사용자가 총예산 슬라이더(80만~150만 원)를 조절하면, 고정비(항공+숙소)를 보존한 채 식비/카페 등 유동 항목의 가격 티어를 가성비 로컬 스팟으로 자동 감축하여 목표 상한선에 수렴시킨다.
- FR-07 (일일 가용 경비 페이스메이커): `(총예산 - 항공·숙박) ÷ (여행 일수 × 인원)`을 계산하여 "오늘 하루 자유롭게 쓸 수 있는 안전 한도(원화 및 외화)"를 실시간 위젯으로 제공한다.
- FR-08 (실청구 환율 버퍼): 단순 고시환율이 아닌 해외브랜드 수수료(1%), 카드사 수수료(0.2%), 환율 변동 마진(1.3%)을 반영한 `FX +2.5%` 실청구 환율을 적용해 해외 결제 청구 폭탄을 방지한다.
- FR-09 (지오 최단 동선 체이닝): 하루 단위 일정 내 장소들을 Nearest-Neighbor 알고리즘으로 체이닝하여 지그재그 이동을 방지하고, 좌표 유실 없이 최적 이동 시간을 산출한다.

### 3.3 [P1] 제로 입력 지출 기록 & OCR (Zero-Input Expense Logging)
- FR-10 (카드 알림 파싱): 신용카드 승인 SMS/알림톡 텍스트 붙여넣기 시, 일시·상호명·통화·원화/외화 금액을 정규식 및 로컬 파서로 즉시 추출한다.
- FR-11 (영수증 OCR 및 DCC 감지): 영수증 사진 업로드 시 상호와 품목을 파싱하며, 해외 결제 시 현지 통화가 아닌 원화 결제(DCC)가 발생했는지 감지하여 수수료 경고 배지를 노출한다.
- FR-12 (개인정보 자동 마스킹): 모든 문자 및 영수증 처리 과정에서 카드 전체 번호, 주민번호, 승인번호 등 민감 정보는 서버 및 LLM 전송 전 `redactSensitiveText`를 통해 즉시 마스킹한다.

---

## 4. 유저 플로우 (User Journey)

### Flow A. 밍글링 식사 후 3초 게스트 정산 플로우
```
1. [호스트] 식사 후 트래블카드로 결제 (알림톡으로 지출 자동 수집)
2. [호스트] MetU 앱에서 "정산 QR 생성" 클릭
3. [게스트] 앱 설치 없이 스마트폰 카메라로 QR 스캔 → `/s/[token]` 웹 접속
4. [게스트] "술 안 마셨어요" 체크박스 터치 → 내 송금액 자동 차감 (예: ₩35,000 → ₩22,000)
5. [게스트] "토스로 1초 송금" 버튼 탭 → 토스 앱 실행 및 송금 완료
```

### Flow B. 예산 맞춤형 여행 기획 및 리밸런싱 플로우
```
1. [사용자] 홈 화면에서 "1초 데모" 또는 "예산 100만원, 2인, 도쿄" 선택
2. [시스템] 실시간 환율 및 항공/호텔 견적 기반 5박 6일 최단 동선 일정 렌더링
3. [사용자] 예산 슬라이더를 100만 원에서 85만 원으로 하향 조정
4. [시스템] AI 리밸런서가 디너 코스를 로컬 가성비 맛집으로 자동 교체 (-₩150,000 절감)
5. [시스템] 일일 안전 가용 한도 및 예산 도넛 차트 동적 업데이트
```

---

## 5. 비기능적 요구사항 및 성능 (Non-Functional Requirements)

1. 로딩 속도 및 경량화:
   - Next.js 이미지 최적화(`formats: ['image/avif', 'image/webp']`)를 통해 이미지 용량을 60% 이상 절감한다.
   - 무거운 외부 라이브러리(GSAP, Lenis 등) 대신 순수 `requestAnimationFrame` 및 CSS Stagger 애니메이션으로 60fps 부드러운 전환을 보장한다.
2. 모바일 최적화 (Mobile-First UX):
   - 360px ~ 430px 모바일 뷰포트에서 가로 스크롤(`overflow-x`) 발생 0건.
   - 모든 대화형 버튼과 링크의 최소 터치 타겟은 `44px × 44px`(`min-h-tap`)을 준수한다.
3. 에러 격리 (Error Resilience):
   - 환율 API나 외부 지도 API 일시 장애 시 앱 전체 크래시를 방지하고, 직전 캐시 환율 또는 안전 Fallback UI를 노출한다.
   - 라우트별 `error.tsx` 및 `global-error.tsx`가 디자인 시스템(`mu-*`)에 맞춰 깨짐 없이 작동한다.

---

## 6. 보안 및 프라이버시 (Security & Privacy)

1. 시크릿 격리: 브라우저 클라이언트 번들에 `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `CRON_SECRET` 등 서버 전용 환경변수가 누출되지 않도록 엄격 분리한다.
2. RLS(Row Level Security) 정책:
   - 초대 토큰 기반 공유 정산은 오직 해당 트립의 멤버 및 유효 토큰 소지자만 읽을 수 있다.
   - 비인증 게스트의 임의 데이터 수정 및 타인 계좌 변조 시도를 원천 차단한다.
3. 무가짜 데이터 원칙: 출처 없는 과장 수치나 AI 생성 가짜 리뷰를 전면 배제하며, 실제 시스템 로직으로 동작하는 코드만을 사용자에게 전달한다.

---

## 7. 차세대 확장 아키텍처: MCP 지향성 (Future Roadmap)

MetU는 차세대 자율 에이전트 표준인 Anthropic MCP (Model Context Protocol) 확장을 로드맵에 포함합니다.

1. Supabase & DB MCP: AI 에이전트가 데이터베이스 스키마와 정산 내역을 구조화된 컨텍스트로 직접 읽고 이상 거래를 실시간 감사.
2. Google Maps & Geo MCP: 단순 서술형 일정 생성이 아닌, 구글맵/오픈스트리트맵 MCP 서버를 통해 실시간 실좌표·영업시간·혼잡도를 주입받아 동선 생성.
3. Fintech & Airline MCP: 카드사 마이데이터 및 항공권/호텔 예약 엔진과 플러그앤플레이로 연결되어 검색부터 결제까지 사람의 입력이 전혀 필요 없는 완전 자동화 여행 에이전트로 진화.

---
(문서 끝)

---

## 부록 A. FR → 구현 매핑 (심사 시점 · main)

작성 기준: origin/main (PR #96 병합 이후, ccb8aa9 근처). 코드가 문서보다 우선합니다.

| FR | 상태 | 경로 / 근거 | PR |
| :--- | :--- | :--- | :--- |
| FR-01 게스트 웹 뷰 | 충족 | pp/s/[token]/page.tsx, 초대 QR → /s/[token] | #91–#94 |
| FR-02 예외 분담 토글 | 충족 | calculateSplit (lib/ledger/share-split.ts), 술 제외 체크박스 | #91–#94 |
| FR-03 토스 1초 딥링크 | 충족(VERIFY) | executeTossTransfer (lib/ledger/toss.ts). 계좌는 DEMO_HOST_PAYOUT 상수 — 공유 RPC 계좌 필드·지갑 연동 후속 | #94 |
| FR-04 게스트 쓰기 차단 | 충족 | 403 guest-readonly / guest-self-only, RLS·라우트 테스트 | 기존 |
| FR-05 1초 데모 고속도로 | 충족 | 홈 ?sample=tokyo, 추천 시트 ?city=, 공개 경로 /onboarding·/onboarding/result (lib/auth/route-access.ts) | #96 |
| FR-06 스마트 예산 리밸런서 | 충족 | BudgetRebalanceBar, 
ebalanceScheduleBudget (lib/budget/rebalancer.ts) | #95 |
| FR-07 일일 가용 경비 | 충족 | DailyBurnRateCard | #95 |
| FR-08 실청구 환율 버퍼 | 충족(VERIFY) | calculateEffectiveFX (lib/finance/fx-buffer.ts) — brand/card/volatility 기본값은 예시. ledger_card_profiles 약관 연동 후속 | #95 |
| FR-09 지오 최단 동선 | 충족 | 일정 최적화 / nearest-neighbor 체이닝 (추천 결과) | #92–#95 |
| FR-10 카드 알림 파싱 | 충족 | paste 파서 · parseCardSms / /api/ledger/parse | 기존 |
| FR-11 영수증 OCR·DCC | 충족 | 영수증 업로드 · DCC 경고 배지 | 기존 |
| FR-12 개인정보 마스킹 | 충족 | 
edactSensitiveText (LLM·저장 전) | 기존 |

### NFR · 보안 (요약)

| 항목 | 상태 | 근거 |
| :--- | :--- | :--- |
| 이미지 avif/webp | 충족 | Next images.formats |
| 터치 44px · 가로스크롤 0 | 충족 | min-h-tap, 모바일 우선 레이아웃 |
| 에러 격리 | 충족 | error.tsx / global-error.tsx, FX·지도 폴백 |
| 시크릿 격리 | 충족 | 서버 env only · NEXT_PUBLIC_ 에 비밀 금지 (audit #94) |
| RLS · 게스트 변조 차단 | 충족 | FR-04 와 동일 |
| §7 MCP | 로드맵 only | 구현·머지 대상 아님 |

### VERIFY / 로드맵 (의도적 미완)

1. **토스 실계좌**: pp/s/[token]/page.tsx 의 DEMO_HOST_PAYOUT — 데모용. 공유 RPC에 계좌 컬럼·지갑 연동 후 서버 값으로 교체.
2. **FX 수수료율**: lib/finance/fx-buffer.ts 기본값(+2.5% 구성)은 VERIFY 예시. 카드 프로필(ledger_card_profiles) 하드 바인딩은 후속.
3. **§7 MCP**: 문서 §7만. Supabase/Maps/Fintech MCP 서버 구현은 이번 심사 범위 밖.
