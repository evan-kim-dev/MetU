export type GuidePlatform = "ios" | "android";

export type GuidePartId = "A" | "B" | "C" | "D";

export interface GuideMistake {
  text: string;
  requiresP4?: boolean;
}

export interface GuideStep {
  id: string;
  part: GuidePartId;
  title: string;
  doItems: string[];
  expect?: string;
  expectRequiresP4?: string;
  mistakes?: GuideMistake[];
  image?: { src: string; alt: string };
  requiresP4?: boolean;
}

export interface GuideFaqItem {
  id: string;
  platform: GuidePlatform | "both";
  symptom: string;
  cause: string;
  fix: string;
  relatedCodes?: string[];
  causeRequiresP4?: boolean;
  fixRequiresP4?: string;
}

export interface GuideIntro {
  title: string;
  description: string;
  checklist: string[];
  timeChip: string;
  difficultyChip: string;
}

export interface GuidePartMeta {
  id: GuidePartId;
  title: string;
}

export interface PlatformGuide {
  intro: GuideIntro;
  parts: GuidePartMeta[];
  steps: GuideStep[];
  faq: GuideFaqItem[];
  outro?: string;
}

export const GUIDE_OVERVIEW: GuideIntro = {
  title: "카드 알림을 자동으로 가계부에 넣기",
  description:
    "카드 앱 알림이 오면 MetU가 금액과 가맹점을 읽어 여행 가계부에 적어 줘요. 설정은 처음 한 번, 약 3분이에요.",
  checklist: [
    "iPhone(iOS 27) 또는 Android 폰",
    "카드/결제 앱의 **알림이 켜져 있어야** 해요 (설정 → 알림 → 해당 앱 → 알림 허용)",
    "MetU에서 **여행을 하나 만들어 둔 상태**(오늘 날짜가 여행 기간에 들어가야 가계부에 바로 들어가요. 없으면 '수신함'에 보관돼요)",
  ],
  timeChip: "약 3분",
  difficultyChip: "처음 한 번만",
};

const IOS_PARTS: GuidePartMeta[] = [
  { id: "A", title: "연결 코드 받고 단축어 추가하기 (MetU 앱 안)" },
  {
    id: "B",
    title: "알림이 오면 단축어가 실행되게 만들기 (iPhone 단축어 앱)",
  },
  { id: "C", title: "연결 확인하기" },
  { id: "D", title: "마무리" },
];

export const IOS_GUIDE: PlatformGuide = {
  intro: GUIDE_OVERVIEW,
  parts: IOS_PARTS,
  outro:
    '완료 후 홈에 **"자동 기록 켜짐 · 마지막 수신 3분 전"** 상태가 보여요. 24시간 이상 알림이 없으면 "최근 알림이 없어요"로 바뀌어요.',
  steps: [
    {
      id: "ios-a1",
      part: "A",
      title: "[iPhone 자동화 추가] 버튼 누르기",
      doItems: [
        "MetU에서 **[iPhone 자동화 추가]**를 한 번만 누르세요. 연결 코드가 자동으로 복사되고 '단축어 추가' 화면이 열려요.",
      ],
      expect:
        '화면 위쪽에 초록 안내 "연결 코드를 복사했어요". 이어서 iCloud/단축어 앱의 **단축어 추가** 화면이 열려요.',
      mistakes: [
        {
          text: "버튼을 두 번 눌러 코드가 두 번 만들어짐 → 마지막으로 복사된 코드만 쓰면 돼요.",
        },
        {
          text: "(이전 코드는 자동으로 사용 중지돼요).",
          requiresP4: true,
        },
        {
          text: '"복사하지 못했어요"가 뜨면 → 화면의 **[연결 코드 복사]**를 누르고 복사 표시가 뜬 뒤 다시 열기.',
        },
      ],
    },
    {
      id: "ios-a2",
      part: "A",
      title: "질문에 연결 코드 붙여넣기",
      doItems: [
        '단축어 추가 화면에서 **"연결 코드" 질문**이 나오면 입력칸을 길게 눌러 **[붙여넣기]**를 누르고 **[계속]**(또는 [다음]).',
      ],
      expect:
        "입력칸에 `metu-` 로 시작하는 코드(예: `metu-XXXX-XXXX-XXXX-XXXX`, 알파벳·숫자 16자 + 하이픈)가 보여요. 이전 버전 코드는 `mtu_`로 시작해도 동작해요.",
      mistakes: [
        {
          text: "붙여넣기 메뉴가 안 뜸 → 클립보드가 비었어요. MetU로 돌아가 **[연결 코드 복사]** 후 다시.",
        },
        {
          text: "앞뒤 공백/줄바꿈이 섞임 → 괜찮아요. 앞뒤 공백은 서버가 지워줘요. 단, **코드 중간을 고치지 마세요**.",
        },
        {
          text: "다른 메신저에서 복사한 글이 붙음 → 코드가 `metu-`로 시작하는지 확인.",
        },
      ],
    },
    {
      id: "ios-a3",
      part: "A",
      title: "[단축어 추가] 누르기",
      doItems: ["맨 아래 **[단축어 추가]**."],
      expect:
        '**단축어 탭 → 모든 단축어**에 **"MetU 알림 전송"**이 생겨요.',
      mistakes: [
        {
          text: '"신뢰할 수 없는 단축어" 경고 → 설정 → 단축어 → **고급 → 신뢰할 수 없는 단축어 허용**을 켜야 추가돼요.',
        },
      ],
    },
    {
      id: "ios-b1",
      part: "B",
      title: "자동화 탭 열기",
      doItems: [
        "**단축어** 앱 → 아래쪽 **[자동화]** 탭 → 오른쪽 위 **[+]**. (이미 자동화가 있으면 [새 자동화]가 보일 수 있어요)",
      ],
      expect: '"새로운 자동화" 시작 목록(시간, 알림, 도착 …)이 보여요.',
      mistakes: [
        {
          text: "**[단축어] 탭에서 [+]**를 누르면 단축어 만들기 화면이에요. 반드시 **[자동화] 탭**에서.",
        },
      ],
    },
    {
      id: "ios-b2",
      part: "B",
      title: "트리거로 [알림] 고르기",
      doItems: ["목록에서 **[알림]** 선택."],
      expect:
        '위에 "앱", 아래에 "알림 수신 시" 같은 설정 항목이 보여요.',
      mistakes: [
        {
          text: "[앱](앱 열기/닫기)을 고름 → 알림이 아니라 앱 실행에 반응해서 기록이 안 돼요.",
        },
      ],
    },
    {
      id: "ios-b3",
      part: "B",
      title: "카드 앱 선택",
      doItems: [
        "**[앱] → [선택]** → 알림을 받는 **카드/결제 앱**(예: 삼성카드, 신한카드, KB국민카드, 토스, 카카오페이 등)을 체크 → **[완료]**.",
      ],
      expect:
        "선택한 앱 이름이 [앱] 줄에 표시돼요. 여러 개를 고를 수 있어요.",
      mistakes: [
        {
          text: "카드사 앱이 아니라 **문자(메시지)**로만 승인 알림이 오는 카드 → 앱 목록에서 **[메시지]**를 고르세요. (내가 쓰는 카드가 어떤 앱으로 알림을 보내는지 모르면 최근 승인 알림을 길게 눌러 앱 이름을 확인)",
        },
        {
          text: "테스트용: 카드 알림이 당장 없으면 **카카오톡**(나와의 채팅 말고, 다른 사람이 보낸 메시지) 또는 **Gmail**(다른 계정이 보낸 메일)을 임시로 추가해도 돼요. ⚠ **내가 나에게 보낸 Gmail은 알림이 안 울릴 수 있어요.**",
        },
      ],
    },
    {
      id: "ios-b4",
      part: "B",
      title: "필터 추가 (꼭!)",
      doItems: [
        '**[제목] / [부제] / [본문]** 중 하나에 **"포함" + 단어**를 넣으세요. 카드 승인 알림에는 보통 **"승인"**이 들어 있어요 → **본문 포함 `승인`**.',
      ],
      expect: "필터가 한 개 이상 생기고, 화면 아래 **[다음]**이 활성화돼요.",
      mistakes: [
        {
          text: '**필터를 비워 두면 자동화가 "꺼져 있음"으로 남아요.** 이게 가장 흔한 막힘이에요.',
        },
        {
          text: '`승인`이 들어가지 않는 알림(예: "결제 완료", "사용 내역")이 오는 카드 → 그 카드가 보내는 실제 알림 문구를 한 번 보고 `결제`/`사용`/`원` 중 하나로 바꾸세요.',
        },
        {
          text: "너무 좁게 잡음(예: `승인 12,000원`) → 금액이 다르면 안 걸려요. 단어 하나만.",
        },
      ],
    },
    {
      id: "ios-b5",
      part: "B",
      title: "동작 추가: MetU 단축어 실행하기",
      doItems: [
        '**[다음]** → **[동작 추가]** → 검색창에 **"단축어 실행"** → **[단축어 실행]** 선택 → 파란 **[단축어]** 글자를 눌러 **[MetU 알림 전송]** 고르기.',
      ],
      expect:
        "한 줄에 `단축어 실행  MetU 알림 전송  입력: …` 처럼 보여요.",
      mistakes: [
        {
          text: "이름이 비슷한 다른 단축어 선택, 또는 파트 A를 건너뛰어 목록에 MetU 단축어가 없음.",
        },
      ],
    },
    {
      id: "ios-b6",
      part: "B",
      title: "입력에 알림 내용(본문·제목) 넘기기",
      doItems: [
        "같은 줄의 **[입력]**(또는 \"입력 없음\")을 탭 → 아래 변수 줄에서 **[알림]** 변수 칩을 고르고, 칩을 탭해 **[본문]**을 선택.",
        "제목도 같이 보내려면 **[제목]**을 한 번 더 넣거나, 텍스트 동작으로 `제목 + 본문`을 합쳐서 전달.",
      ],
      expect:
        '입력 자리에 **파란 알약(변수 칩) "알림 › 본문"** 같은 것이 들어가 있어요. 그냥 글자(`본문`)를 타이핑한 게 아니라 **칩**이어야 해요.',
      mistakes: [
        {
          text: "**입력을 비워 둠** → 단축어가 받은 글이 없어서 실행하면 `text_or_body_required` 오류가 나요.",
        },
        {
          text: '칩이 아니라 일반 글자 "본문"을 입력함 → 서버에 \'본문\'이라는 글자만 가요(돈 내용 없음).',
        },
      ],
    },
    {
      id: "ios-b7",
      part: "B",
      title: "실행 설정: 즉시 실행",
      doItems: [
        "**[다음]** → 마지막 화면에서 **[즉시 실행]**을 선택하고, **[실행 전에 묻기]**(실행 전 확인)는 **끔** → **[완료]**.",
      ],
      expect:
        "목록에 **알림 → MetU 알림 전송** 자동화가 생기고, 오른쪽이 켜짐(초록 토글)으로 보여요.",
      mistakes: [
        {
          text: "**[실행 전에 묻기]가 켜져 있음** → 알림이 올 때마다 확인 배너만 뜨고 실행은 안 돼요(자동 기록 안 됨).",
        },
        {
          text: "자동화가 꺼져 있음(회색 토글) → 필터를 안 넣었을 때 생겨요. B-4로.",
        },
      ],
    },
    {
      id: "ios-c1",
      part: "C",
      title: "서버 테스트 (앱에서)",
      doItems: ["MetU 3단계 **[서버 연결 테스트]** 버튼."],
      expect:
        '**"MetU 서버가 테스트 알림을 받았어요 ✓"** (초록). 이 단계는 로그인한 내 계정으로 MetU 서버만 확인해요. **연결 코드와 폰 자동화는 확인하지 않아요.**',
      mistakes: [
        {
          text: "이 ✓만 보고 끝냄 → 폰 쪽 확인(C-2)까지 해야 실제 알림이 들어와요.",
        },
      ],
    },
    {
      id: "ios-c2",
      part: "C",
      title: "폰 테스트 (단축어 직접 실행)",
      doItems: [
        "단축어 앱 → **[단축어] 탭** → **MetU 알림 전송**의 `…`/▶를 눌러 한 번 실행.",
        "⚠ **입력이 비어 있으면 `text_or_body_required` 오류가 나는 게 정상이에요.** 수동 실행은 알림이 없어서 보낼 글이 없기 때문이에요. 오류 화면에서 닫아도 돼요. 자동 실행 테스트는 C-3에서 해요.",
      ],
      expect:
        "완료 알림 또는 MetU 최근 수신에 `MTU-TEST` 항목이 **'연결 테스트'**로 표시.",
      mistakes: [
        {
          text: "수동 실행에서 `text_or_body_required`가 나오면 정상이에요. C-3에서 실제 알림으로 확인해 주세요.",
        },
      ],
    },
    {
      id: "ios-c3",
      part: "C",
      title: "진짜 알림으로 테스트",
      doItems: [
        "선택한 앱에서 필터 단어(`승인`)가 들어간 알림을 하나 받으세요(카드 소액 결제, 또는 카카오톡/다른 계정 Gmail로 `승인 테스트 1,000원` 보내기).",
      ],
      expect:
        "MetU 화면 **'최근 수신'**에 몇 초 안에 새 줄이 생기고 여행 기간 안이면 가계부에도 지출이 생겨요.",
      expectRequiresP4:
        'MetU 화면 **\'최근 수신\'**에 몇 초 안에 새 줄이 생기고 상단에 **"알림이 도착했어요 🎉"** 배너가 떠요. 여행 기간 안이면 가계부에도 지출이 생겨요.',
      mistakes: [
        {
          text: "**수신은 됐는데 가계부에 없음** → 여행이 없거나 오늘 날짜가 여행 기간(±1일) 밖이면 '수신함'에 보관만 돼요. 수신함에서 [여행에 배정].",
        },
        { text: "아무것도 안 옴 → 아래 FAQ 1~6." },
      ],
    },
  ],
  faq: [
    {
      id: "ios-faq-1",
      platform: "ios",
      symptom: '자동화가 **"꺼져 있음"**으로만 나옴',
      cause: "필터가 없거나 알림 트리거 설정이 덜 끝남",
      fix: "해당 자동화 열기 → **필터에 `승인` 같은 단어 추가** → 완료 → 토글 켜기 (B-4)",
    },
    {
      id: "ios-faq-2",
      platform: "ios",
      symptom: "알림이 와도 아무 일도 없음",
      cause: "[실행 전에 묻기]가 켜짐 / 앱 선택이 틀림",
      fix: "**즉시 실행**으로 바꾸고 [실행 전에 묻기] 끄기(B-7). 앱 목록에 카드 앱이 맞는지 확인",
    },
    {
      id: "ios-faq-3",
      platform: "ios",
      symptom: "단축어 수동 실행 시 **`text_or_body_required`**",
      cause: "입력이 비어 있음(정상)",
      fix: "오류 무시. 실제 알림이나 C-3으로 테스트",
      relatedCodes: ["text-or-body-required"],
    },
    {
      id: "ios-faq-4",
      platform: "ios",
      symptom: '**`unauthorized`** / "연결 코드가 올바르지 않아요"',
      cause: "연결 코드가 틀렸거나",
      causeRequiresP4: true,
      fix: 'MetU에서 **[연결 코드 다시 만들기]** → 새 코드를 단축어의 "연결 코드" 값에 교체(단축어 편집 → 맨 위 텍스트/가져오기 동작의 코드 칸)',
      relatedCodes: ["unauthorized-code"],
    },
    {
      id: "ios-faq-5",
      platform: "ios",
      symptom: "**`validation-failed`** + `receivedAt`",
      cause: "보내는 시각 형식이 시간대(+09:00 등)가 없음",
      fix: "단축어의 날짜 형식을 **ISO 8601**로(예: `2026-10-31T12:00:00+09:00`), 또는 시각 항목을 아예 지워도 돼요(서버가 받은 시각 사용)",
      relatedCodes: ["received-at-format"],
    },
    {
      id: "ios-faq-6",
      platform: "ios",
      symptom: '**429 / "요청이 많아요"**',
      cause: "짧은 시간에 너무 많이 시도",
      fix: "1분 뒤 다시. 테스트는 분당 5번까지",
      relatedCodes: ["rate-limited"],
    },
    {
      id: "ios-faq-7",
      platform: "ios",
      symptom: '**500 / "서버에 문제가 생겼어요"** (hint에 마이그레이션 언급)',
      cause: "MetU 서버 설정/DB 마이그레이션",
      fix: "개발자에게 전달(운영자용: `20261030160000/170000` 적용 확인). 잠시 후 재시도",
      relatedCodes: ["server-error"],
    },
    {
      id: "ios-faq-8",
      platform: "ios",
      symptom: "수신은 되는데 가계부에 안 보임",
      cause: "여행 없음/기간 밖 → '수신함 보관'",
      fix: "홈의 **[여행 만들기]** 또는 수신함에서 **[여행에 배정]**",
    },
    {
      id: "ios-faq-9",
      platform: "ios",
      symptom: "내가 나에게 보낸 Gmail이 안 잡힘",
      cause: "Gmail은 내가 보낸 메일엔 알림을 안 울릴 수 있어요",
      fix: "다른 계정/사람에게 받거나 카카오톡 메시지를 사용",
    },
    {
      id: "ios-faq-10",
      platform: "ios",
      symptom: "알림은 오는데 단축어가 안 돎",
      cause: "앱 알림이 요약/그룹화되어 자동화가 안 걸림, 집중 모드",
      fix: "설정 → 알림 → 해당 앱 → **즉시 전달**, 알림 요약 끄기",
    },
    {
      id: "ios-faq-11",
      platform: "ios",
      symptom: "홈 화면 앱(PWA)에서 열었더니 로그아웃",
      cause: "iOS는 Safari와 홈 화면 앱의 로그인이 따로 저장돼요",
      fix: "홈 화면 앱에서 한 번 더 로그인",
    },
    {
      id: "ios-faq-12",
      platform: "ios",
      symptom: '"연결 코드 복사하지 못했어요"',
      cause: "iOS가 자동 복사를 막음",
      fix: "**[연결 코드 복사]** 버튼을 직접 눌러 복사 → 단축어 추가 화면에서 붙여넣기",
    },
    {
      id: "ios-faq-13",
      platform: "ios",
      symptom: "금액이 이상하게 기록됨",
      cause: "알림 문구 형식이 특이함",
      fix: "수신함에서 해당 항목 수정/무시. 개선을 위해 앱 이름과 문구를 알려주세요",
    },
  ],
};

const ANDROID_PARTS: GuidePartMeta[] = [
  { id: "A", title: "준비" },
  { id: "B", title: "매크로 만들기" },
  { id: "C", title: "확인" },
];

export const ANDROID_GUIDE: PlatformGuide = {
  intro: GUIDE_OVERVIEW,
  parts: ANDROID_PARTS,
  steps: [
    {
      id: "and-a1",
      part: "A",
      title: "MacroDroid 설치",
      doItems: ["Play 스토어에서 **MacroDroid** 설치."],
    },
    {
      id: "and-a2",
      part: "A",
      title: "알림 접근 권한",
      doItems: [
        "앱을 열고 안내에 따라 **알림 접근 권한** 허용: 설정 → 알림 → **기기 및 앱 알림**(또는 '알림 접근') → **MacroDroid 켜기**.",
      ],
    },
    {
      id: "and-a3",
      part: "A",
      title: "배터리 설정",
      doItems: [
        "배터리: 설정 → 앱 → MacroDroid → 배터리 → **제한 없음**(또는 '최적화 안 함'). 켜 두지 않으면 화면이 꺼진 뒤 매크로가 멈춰요.",
      ],
    },
    {
      id: "and-a4",
      part: "A",
      title: "연결 코드",
      doItems: ["MetU에서 **[연결 코드 만들기]**로 코드를 만들고 복사."],
    },
    {
      id: "and-b1",
      part: "B",
      title: "매크로 시작",
      doItems: ["**[매크로 추가]** 또는 **[+]**."],
    },
    {
      id: "and-b2",
      part: "B",
      title: "알림 트리거",
      doItems: ["**트리거 [+] → 앱/알림 → [알림 수신]**."],
    },
    {
      id: "and-b3",
      part: "B",
      title: "앱·필터",
      doItems: [
        "**애플리케이션 선택**: 카드/결제 앱 체크. **텍스트 필터**: 알림 텍스트 **포함 `승인`**.",
      ],
    },
    {
      id: "and-b4",
      part: "B",
      title: "HTTP 요청",
      doItems: [
        "**액션 [+] → 연결 → [HTTP 요청]**:",
        "요청 방식: **POST**",
        "URL: `https://met-u.vercel.app/api/ingest/notification` (앱이 현재 도메인으로 자동 채워서 보여줌)",
        "요청 헤더 2개:",
        "`Authorization` : `Bearer ` + **내 연결 코드** (Bearer 뒤 **공백 한 칸**)",
        "`Content-Type` : `application/json`",
        "본문(Body, JSON): 아래 형태. `{ }` 아이콘(매직 텍스트)으로 알림 값 삽입.",
        `{"app":"<알림 앱 이름>","title":"<알림 제목>","body":"<알림 텍스트>"}`,
        "`<…>` 자리에 매직 텍스트(알림 앱 이름/제목/텍스트)를 칩으로 넣으세요. **시각(received_at)은 넣지 마세요**(서버가 받은 시간을 써요).",
      ],
    },
    {
      id: "and-b5",
      part: "B",
      title: "저장",
      doItems: [
        "이름 `MetU 알림 전송` 으로 저장 → 매크로 목록에서 켜짐 확인.",
      ],
    },
    {
      id: "and-c1",
      part: "C",
      title: "HTTP 테스트",
      doItems: [
        "매크로 편집 화면 **[테스트 액션]**으로 HTTP 요청만 먼저 실행 → 응답 `202`/`200`이면 OK(`401`이면 코드/헤더 확인).",
      ],
    },
    {
      id: "and-c2",
      part: "C",
      title: "실제 알림",
      doItems: [
        "실제 알림(또는 다른 앱이 보낸 `승인` 포함 알림) → MetU **최근 수신** 확인.",
      ],
    },
  ],
  faq: [
    {
      id: "and-faq-1",
      platform: "android",
      symptom: "`401 unauthorized`",
      cause: "",
      fix: "`Bearer` 뒤 공백, 코드 오타",
      fixRequiresP4: ", 코드 재발급으로 이전 코드 중지 여부 확인",
    },
    {
      id: "and-faq-2",
      platform: "android",
      symptom: "`400 validation-failed`",
      cause: "",
      fix: "`app`/`body`가 비어 있음 → 매직 텍스트 칩이 들어갔는지 확인. JSON 따옴표 `\"` 확인",
    },
    {
      id: "and-faq-3",
      platform: "android",
      symptom: "알림이 와도 매크로 안 돎",
      cause: "",
      fix: "알림 접근 권한, 배터리 제한 없음, 텍스트 필터(`승인`)",
    },
    {
      id: "and-faq-4",
      platform: "android",
      symptom: "몇 시간 뒤부터 멈춤",
      cause: "",
      fix: "제조사 절전(삼성: 설정 → 배터리 → 백그라운드 사용 제한 → 예외 앱 추가)",
    },
    {
      id: "and-faq-5",
      platform: "android",
      symptom: '홈에 "자동 기록 꺼짐"',
      cause: "",
      fix: "24시간 이상 수신 없음 → 알림 접근 권한/매크로 활성 확인",
    },
  ],
};

export interface GuideSideSection {
  id: string;
  title: string;
  intro?: string;
  items: string[];
  note?: string;
}

/**
 * 문자(메시지)로만 승인 알림이 오는 카드용 짧은 섹션 (StepAutomation, iOS).
 * 알림 자동화(ios-b1~b7)와 같은 단축어·같은 연결 코드를 쓴다. 가이드 본문(ios-b3)의
 * "[메시지] 앱 선택"과 충돌하면 기존 가이드가 우선이다.
 * VERIFY: 단축어 앱의 '메시지' 자동화 메뉴명/변수명은 iOS 버전별로 다를 수 있음(작성 시점 조사 기준).
 */
export const IOS_SMS_AUTOMATION_SECTION: GuideSideSection = {
  id: "ios-sms-automation",
  title: "문자로만 승인 알림이 오는 카드",
  intro:
    "알림 자동화에서 [메시지] 앱을 골라도 잡히지 않으면, 문자를 직접 받는 자동화를 하나 더 만들어요.",
  items: [
    "**단축어** 앱 → **[자동화]** 탭 → **[+]** → **[메시지]**를 골라요.",
    "**보낸 사람** 또는 **메시지 내용**에 **포함** 조건을 넣어요. 카드 승인 문자에는 보통 **`승인`**이 들어 있어요.",
    "**[즉시 실행]**을 고르고 **[실행 전에 묻기]**는 꺼요.",
    "동작은 **[단축어 실행] → [MetU 알림 전송]**이에요. 입력에는 글자가 아니라 **메시지 내용 변수 칩**을 넣어요. 알림 자동화와 같은 연결 코드로 MetU에 전달돼요.",
  ],
  note: "메시지 자동화는 문자로 온 승인 안내만 보내요. 앱 알림과 문자 둘 다 오는 카드는 한쪽만 만들어도 돼요.",
};

/**
 * Android: PWA 설치 후 같은 흐름 + MacroDroid 안내 카드.
 * VERIFY: 제조사별 배터리 최적화 메뉴명은 기기/OS 버전마다 다를 수 있음(작성 시점 조사 기준).
 */
export const ANDROID_PWA_FLOW_SECTION: GuideSideSection = {
  id: "android-pwa-flow",
  title: "Android도 같은 흐름이에요",
  intro:
    "MetU를 홈 화면에 설치한 뒤 같은 화면에서 연결 코드를 만들고, 알림을 읽는 일은 MacroDroid가 해요.",
  items: [
    "MetU에서 연결 코드를 만들어 복사해요.",
    "MacroDroid에서 카드 앱 알림을 받는 매크로를 만들고 연결 코드를 넣어요.",
  ],
  note: "제조사마다 배터리 최적화 메뉴 이름이 달라요. MacroDroid를 '제한 없음' 또는 절전 예외 앱으로 해 두지 않으면 화면이 꺼진 뒤 멈출 수 있어요.",
};

export function faqForCode(code: string): GuideFaqItem | undefined {
  const all = [...IOS_GUIDE.faq, ...ANDROID_GUIDE.faq];
  return all.find((item) => item.relatedCodes?.includes(code));
}

export function detectPlatform(
  userAgent: string
): GuidePlatform | "desktop" {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  return "desktop";
}

const IOS_FORBIDDEN =
  /\bBearer\b|Authorization|\bcurl\b|\bJSON\b|토큰|\bPOST\b|\bendpoint\b/i;

export function collectIosUserVisibleStrings(
  revokeOnReissue: boolean
): string[] {
  const texts: string[] = [
    GUIDE_OVERVIEW.title,
    GUIDE_OVERVIEW.description,
    ...GUIDE_OVERVIEW.checklist,
    IOS_GUIDE.outro ?? "",
  ];
  for (const step of IOS_GUIDE.steps) {
    if (step.requiresP4 && !revokeOnReissue) continue;
    texts.push(step.title, ...step.doItems);
    const expect =
      revokeOnReissue && step.expectRequiresP4
        ? step.expectRequiresP4
        : step.expect;
    if (expect) texts.push(expect);
    for (const m of step.mistakes ?? []) {
      if (m.requiresP4 && !revokeOnReissue) continue;
      texts.push(m.text);
    }
  }
  texts.push(
    IOS_SMS_AUTOMATION_SECTION.title,
    IOS_SMS_AUTOMATION_SECTION.intro ?? "",
    ...IOS_SMS_AUTOMATION_SECTION.items,
    IOS_SMS_AUTOMATION_SECTION.note ?? ""
  );
  for (const item of IOS_GUIDE.faq) {
    texts.push(item.symptom, item.cause, item.fix);
    if (item.causeRequiresP4 && revokeOnReissue) {
      texts.push(", 새로 만들면서 이전 코드가 중지됨");
    }
  }
  return texts.filter(Boolean);
}

export function assertIosUserStringsSafe(revokeOnReissue: boolean): void {
  for (const text of collectIosUserVisibleStrings(revokeOnReissue)) {
    if (IOS_FORBIDDEN.test(text)) {
      throw new Error(`Forbidden term in iOS guide: ${text.slice(0, 40)}…`);
    }
  }
}

export function resolveFaqCause(
  item: GuideFaqItem,
  revokeOnReissue: boolean
): string {
  if (item.causeRequiresP4 && revokeOnReissue) {
    return `${item.cause}, 새로 만들면서 이전 코드가 중지됨`;
  }
  return item.cause;
}

export function resolveFaqFix(
  item: GuideFaqItem,
  revokeOnReissue: boolean
): string {
  if (item.fixRequiresP4 && revokeOnReissue) {
    return `${item.fix}${item.fixRequiresP4}`;
  }
  return item.fix;
}

export function resolveStepExpect(
  step: GuideStep,
  revokeOnReissue: boolean
): string | undefined {
  if (revokeOnReissue && step.expectRequiresP4) {
    return step.expectRequiresP4;
  }
  return step.expect;
}
