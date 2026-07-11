/** Shared AI prompt constraints — keep short to save tokens */
export const AI_NO_FAKE_QUOTES =
  "항공·숙소 임의 견적 금액 금지. RAG 밖 사실 단정 금지.";

/**
 * Met U 사용자-facing AI 어투.
 * 해요체만 사용 (~해요 / ~이에요 / ~예요 / ~세요 / ~드릴게요 / ~했어요).
 * 문어체(~다 / ~한다 / ~입니다) 금지.
 */
export const AI_VOICE =
  "어투는 친근한 해요체만. ~해요/~이에요/~예요/~세요/~드릴게요/~했어요. ~다/~한다/~입니다 금지.";
