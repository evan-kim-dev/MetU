# iOS 단축어로 MetU 알림 전송하기

작성 시점 조사 기준 예시입니다. iOS 버전·단축어 UI는 바뀔 수 있어요. (`VERIFY:`)

## 준비물

1. MetU 웹에서 발급한 **연결 코드** (Bearer 토큰, `metu-` 로 시작. 예: `metu-K7QF-2MXP-9HCA-R4TD`)
2. iPhone (알림 자동화는 최신 iOS 권장)
3. 단축어 앱

환경변수 `NEXT_PUBLIC_IOS_SHORTCUT_URL` 이 있으면 온보딩에서 iCloud 링크를 바로 열 수 있어요.
없으면 앱 안 안내(`/onboarding/shortcut-guide`)와 이 문서를 따라 직접 만드세요.

## 1. 단축어 만들기 (수동)

1. 단축어 앱 → **자동화** → **개인 자동화** → **만들기**
2. 트리거: **앱** → **앱이 알림을 받을 때** (또는 “알림”) → 카드 앱 선택
3. **실행 전에 묻기** 끄기
4. 동작 추가:
   - **텍스트** (알림 본문/제목을 변수로 합침)
   - **URL 내용 가져오기** (POST)

### URL 내용 가져오기 설정

- URL: `https://met-u.vercel.app/api/ingest/notification` (또는 내 배포 도메인)
- 방법: POST
- 헤더:
  - `Authorization`: `Bearer <연결 코드>`
  - `Content-Type`: `application/json`
- 요청 본문 (JSON):

```json
{
  "app": "KB Pay",
  "title": "결제 알림",
  "body": "승인 12,000원",
  "received_at": "2026-10-30T12:00:00+09:00"
}
```

단축어 변수로 `app` / `title` / `body` / 현재 시각을 넣으면 됩니다.
`receivedAt`(camelCase) 도 동일하게 허용해요.

## 2. 테스트

1. 본문을 `MTU-TEST 연결 확인` 으로 한 번 보내기
2. MetU 온보딩 3단계가 **연결 확인됨** 으로 바뀌는지 확인
3. 실제 카드 알림 후 `/agent/inbox` 에 이벤트가 보이는지 확인

curl 예시:

```bash
curl -X POST "https://met-u.vercel.app/api/ingest/notification" \
  -H "Authorization: Bearer metu-XXXX-XXXX-XXXX-XXXX" \
  -H "content-type: application/json" \
  -d "{\"app\":\"Test\",\"title\":\"ping\",\"body\":\"MTU-TEST\",\"received_at\":\"2026-10-30T12:00:00+09:00\"}"
```

## 3. 흔한 오류 5개

1. **401 unauthorized** — 연결 코드가 잘못됐거나 앞뒤 공백/따옴표가 들어감
2. **400 validation-failed** — `body` 또는 `app` 누락, 날짜 형식 오류
3. **자동화 안 뜸** — 트리거 앱을 카드 앱으로 골랐는지, “실행 전에 묻기” 가 켜져 있는지
4. **온보딩이 안 바뀜** — 본문이 `MTU-TEST` 로 시작해야 기기 테스트로 기록됨
5. **미할당만 쌓임** — 여행 기간 밖 알림은 정상이에요. 여행 만들거나 수신함에서 수동 배정

## 4. 보안

- 연결 코드는 비밀번호처럼 다루세요. 채팅/스크린샷에 올리지 마세요.
- 유출되면 MetU → 자동 수집 연결에서 토큰을 폐기하고 새로 발급하세요.
