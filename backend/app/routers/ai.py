from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import json

from app.schemas.ai_outputs import AiMode
from app.services.ai_plan import STREAMABLE_TEXT_MODES, InsightService

router = APIRouter(prefix="/ai", tags=["ai"])
service = InsightService()


class ChatRequest(BaseModel):
    system: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    mode: AiMode = "budget"


class ChatResponse(BaseModel):
    content: str | None = None
    source: str
    validated: bool = False
    cached: bool = False


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    """
    Unified AI chat entry (buffered).
    Structured outputs are validated with Pydantic inside InsightService.
    `content` remains a string for Next.js BFF compatibility.
    """
    content, cached = await service.generate(
        mode=body.mode,
        prompt=body.prompt,
        system=body.system,
    )
    if not content:
        return ChatResponse(
            content=None, source="fallback", validated=False, cached=False
        )
    return ChatResponse(
        content=content, source="ai", validated=True, cached=cached
    )


@router.post("/chat/stream")
async def chat_stream(body: ChatRequest) -> StreamingResponse:
    """
    SSE stream for text modes (buddy, budget, …).
    Events: meta | token | done | error  (JSON in `data:` lines)
    """
    if body.mode not in STREAMABLE_TEXT_MODES:
        async def _reject():
            payload = json.dumps(
                {"type": "error", "message": f"mode-{body.mode}-not-streamable"},
                ensure_ascii=False,
            )
            yield f"data: {payload}\n\n"

        return StreamingResponse(
            _reject(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    async def event_gen():
        async for event in service.stream_text(
            mode=body.mode,
            prompt=body.prompt,
            system=body.system,
        ):
            payload = json.dumps(event, ensure_ascii=False)
            yield f"data: {payload}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
