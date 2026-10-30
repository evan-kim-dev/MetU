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

`/api/ingest/sms` 도 같은 토큰으로 `{ "text":"…", "receivedAt":"ISO+오프셋" }` 을 받아요.

## 2-1. 단축어에서 서버 응답 보기 (알림 표시)

1. `URL 내용 가져오기` 바로 아래에 **알림 보기**(Show Notification) 추가
2. 본문에 변수 **URL의 내용**을 넣기 → `{"eventId":"…","status":"unassigned","message":"…"}` 또는 `{"error":"…","hint":"…"}` 가 뜸
3. (선택) `사전에서 값 가져오기`로 `status` / `error` / `message` 만 뽑아 읽기 쉽게
4. 자동화는 **즉시 실행**. 수동 ▶ 실행은 입력이 비어 `text_or_body_required` 가 나올 수 있어요(정상)

해석:
- `200`/`202` + `status` → 수신 성공. `unassigned` = 여행 없어 보관(정상)
- `duplicate:true` → 같은 분·같은 내용 재전송
- `hint` 에 마이그레이션 안내 → Supabase에 `20261030160000`/`170000` 적용 필요

## 3. 흔한 오류

1. **401 unauthorized** — 연결 코드가 잘못됐거나 앞뒤 공백/따옴표가 들어감
2. **400 validation-failed** — `body`/`text` 누락, `receivedAt`이 오프셋 없는 ISO(예: 로컬 시각만)인 경우
3. **자동화 안 뜸** — 트리거 앱을 카드 앱으로 골랐는지, “실행 전에 묻기” 가 켜져 있는지
4. **온보딩이 안 바뀜** — 본문이 `MTU-TEST` 로 시작하거나, 아무 알림이든 수신되면 최근 수신 목록에 나타남
5. **미할당만 쌓임** — 여행 기간 밖 알림은 정상이에요. 금액·가맹점 **미리보기**는 수신함/온보딩에 보이고, 여행 만들거나 수신함에서 수동 배정
6. **source** — 모르는 값이어도 서버가 `sms_shortcut`으로 받아 줘요(400 안 냄)

## 4. 보안

- 연결 코드는 비밀번호처럼 다루세요. 채팅/스크린샷에 올리지 마세요.
- 유출되면 MetU → 자동 수집 연결에서 토큰을 폐기하고 새로 발급하세요.
