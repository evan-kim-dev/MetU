import type { AiMode } from "@/lib/ai/contracts";

const STRUCTURED_COMMON = `[필수 출력 규칙]
- 반드시 JSON만 출력하세요. 마크다운 코드펜스 금지.
- 허위 항공·숙소 가격을 단정하지 마세요.
- 실존하지 않는 장소·항공사·호텔을 지어내지 마세요.
- 한국어 해요체를 사용하세요.`;

const MODE_APPENDIX: Partial<Record<AiMode, string>> = {
  plan: `${STRUCTURED_COMMON}\n[추가] dailySchedule 각 item의 detail 필수.`,
  tips: `${STRUCTURED_COMMON}\n[추가] tips 배열 6~8개. emoji/title/description 필수.`,
  weather: STRUCTURED_COMMON,
  deals: STRUCTURED_COMMON,
  deal: STRUCTURED_COMMON,
  budget: `${STRUCTURED_COMMON}\n[추가] {"text":"..."} 형태 또는 본문만.`,
  party: STRUCTURED_COMMON,
  style: STRUCTURED_COMMON,
  schedule: STRUCTURED_COMMON,
  factbomb: STRUCTURED_COMMON,
  summary: STRUCTURED_COMMON,
  itinerary: STRUCTURED_COMMON,
  itinerary_patch: STRUCTURED_COMMON,
  expense_parse: STRUCTURED_COMMON,
  expense_text: STRUCTURED_COMMON,
  receipt_vision: STRUCTURED_COMMON,
};

export class AiInputError extends Error {
  readonly status = 413;
  constructor(message: string) {
    super(message);
    this.name = "AiInputError";
  }
}

const MAX_MESSAGES = Number(process.env.AI_MAX_MESSAGES ?? "20");
const MAX_CHARS = Number(process.env.AI_MAX_PROMPT_CHARS ?? "4000");

export function buildInsightSystem(mode: AiMode, system?: string): string {
  const base = (system?.trim() || "당신은 MetU 여행 도우미입니다.").trim();
  const appendix = MODE_APPENDIX[mode];
  return appendix ? `${base}\n\n${appendix}` : base;
}

/** External text is data — never treat as system instructions (rule 15). */
export function sanitizeUserPrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.length > MAX_CHARS) {
    throw new AiInputError("prompt-too-long");
  }
  return trimmed;
}

export function assertMessages(
  messages: Array<{ role: string; content: string }> | undefined
): void {
  if (!messages) return;
  if (messages.length > MAX_MESSAGES) {
    throw new AiInputError("too-many-messages");
  }
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") {
      throw new AiInputError("invalid-role");
    }
  }
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  if (total > MAX_CHARS) {
    throw new AiInputError("messages-too-long");
  }
}
