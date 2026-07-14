"""Server-side prompt hardening: constraints + few-shot examples per mode.

Frontend still sends task-specific context in `system`/`prompt`.
We append these appendices so the model always sees hard rules.
"""

from __future__ import annotations

STRUCTURED_COMMON = """
[필수 출력 규칙]
- 반드시 JSON만 출력하세요. 마크다운 코드펜스(```) 금지.
- 허위 항공·숙소 가격(원, %, 만원)을 단정하지 마세요.
- 실존하지 않는 장소명·항공사·호텔 브랜드를 지어내지 마세요.
- 불확실한 정보는 부드러운 추측("~할 수 있어요")으로 표현하세요.
- 한국어 해요체를 사용하세요.
""".strip()

FEW_SHOT_PLAN = """
[Few-shot: plan JSON 형태 예시 — 값은 예시일 뿐, 실제 입력·DESTINATION_ATTRACTIONS를 따르세요]
{
  "summary": "후쿠오카 3박 4일은 하카타를 축으로 시내 맛집과 공원 산책을 촘촘히 넣었어요. 첫째 날은 도착 후 가볍게, 중간 이틀은 동선이 가까운 명소로 묶고, 마지막 날은 체크아웃 뒤 공항 이동 여유를 남겼어요.",
  "flight": {
    "airline": "저비용 항공 추천",
    "schedule": "가는 편 09:40 · 오는 편 18:20",
    "note": "수하물 포함 여부를 예약 전에 확인하고, 귀국편은 공항 도착을 2시간 전으로 잡아 보세요."
  },
  "hotel": {
    "name": "하카타역 인근 시티 호텔",
    "area": "하카타 / 텐진",
    "note": "전철 접근이 좋은 역세권이 동선 낭비를 줄여 줘요. 조식은 일정에 따라 선택하세요."
  },
  "dailySchedule": [
    {
      "day": 1,
      "label": "도착 · 시내 적응",
      "items": [
        {"time": "14:00", "title": "후쿠오카 공항 → 하카타", "detail": "지하철로 시내에 들어와 숙소에 짐을 내려요."},
        {"time": "16:00", "title": "숙소 체크인", "detail": "체크인 후 짧게 쉬고 가벼운 옷으로 나와요."},
        {"time": "17:30", "title": "캐널시티 하카타", "detail": "강변을 걸으며 동네 분위기를 익혀요. 1시간 정도면 충분해요."}
      ]
    }
  ],
  "tips": [
    "IC카드를 미리 충전해 두면 전철·버스가 편해요.",
    "인기 라멘집은 오픈 직후나 늦은 오후에 가는 게 대기 짧아요."
  ]
}
""".strip()

FEW_SHOT_TIPS = """
[Few-shot: tips JSON]
{"tips":[{"emoji":"🚃","title":"교통 패스","description":"짧은 일정이면 일일권보다 IC카드 충전이 낭비가 적어요. 공항 환승 동선도 미리 앱으로 확인해요."}]}
""".strip()

FEW_SHOT_WEATHER = """
[Few-shot: weather JSON]
{"summary":"낮에는 따뜻하고 저녁은 선선해요. 소나기 가능성이 있어 접이식 우산을 챙기면 좋아요.","preparation":["접이식 우산","얇은 겉옷","편한 걷기 신발"]}
""".strip()

FEW_SHOT_DEALS = """
[Few-shot: deals JSON]
{"deals":[{"id":"fukuoka","highlight":"짧은 비행과 먹거리 밀도가 높아 단기 가성비 여행에 좋아요."}]}
""".strip()

FEW_SHOT_DEAL = """
[Few-shot: deal enrich JSON]
{"summary":"하카타를 축으로 먹거리와 시내 이동이 쉬운 단기 여행지예요. 항공·숙소는 시즌에 따라 변동폭이 커요.","whyCheap":["근거리 노선이 많아 항공 선택의 폭이 넓어요.","역세권 비즈니스 호텔 시세가 비교적 안정적이에요."],"budgetTips":["주중 출발을 고르면 항공이 유리해요.","조식 불포함 옵션으로 식비를 조절해요."],"mustTry":["하카타 라멘","캐널시티 산책"],"caution":"성수기·연휴에는 식당 대기와 숙소비가 함께 올라가요. 예약은 여유 있게 하세요."}
""".strip()

FEW_SHOT_TEXT = """
[Few-shot: text JSON]
{"text":"총 예산 기준으로는 일본 근교·대만이 현실적이에요. 인원이 늘면 1인당 예산이 줄어 권역이 더 좁아질 수 있어요."}
""".strip()

MODE_PROMPT_APPENDIX: dict[str, str] = {
    "plan": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_PLAN}\n\n[추가] dailySchedule 각 item의 detail은 필수. DESTINATION_ATTRACTIONS 실명 우선.",
    "tips": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_TIPS}\n\n[추가] tips 배열 6~8개. emoji/title/description 모두 필수.",
    "weather": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_WEATHER}",
    "deals": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_DEALS}",
    "deal": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_DEAL}",
    "budget": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_TEXT}\n\n[추가] 반드시 {{\"text\": \"...\"}} 형태로만 출력.",
    "party": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_TEXT}\n\n[추가] 반드시 {{\"text\": \"...\"}} 형태로만 출력.",
    "factbomb": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_TEXT}\n\n[추가] 반드시 {{\"text\": \"...\"}} 형태로만 출력. 과장 없이 직설적.",
    "style": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_TEXT}\n\n[추가] 반드시 {{\"text\": \"...\"}} 형태로만 출력.",
    "schedule": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_TEXT}\n\n[추가] 반드시 {{\"text\": \"...\"}} 형태로만 출력.",
    "summary": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_TEXT}\n\n[추가] 반드시 {{\"text\": \"...\"}} 형태로만 출력.",
    "buddy": f"{STRUCTURED_COMMON}\n\n{FEW_SHOT_TEXT}\n\n[추가] 반드시 {{\"text\": \"...\"}} 형태로만 출력. 짧고 친근하게.",
}


def build_system_prompt(mode: str, client_system: str) -> str:
    appendix = MODE_PROMPT_APPENDIX.get(mode, STRUCTURED_COMMON)
    return f"{client_system.strip()}\n\n---\n{appendix}".strip()
