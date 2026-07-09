from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.ai_plan import InsightService

router = APIRouter(prefix="/ai", tags=["ai"])
service = InsightService()


class ChatRequest(BaseModel):
    system: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    mode: str = Field(default="budget", pattern="^(budget|party|deal)$")


class ChatResponse(BaseModel):
    content: str | None = None
    source: str


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    if body.mode == "deal":
        content = await service.deal_enrich(prompt=body.prompt, system=body.system)
    elif body.mode == "party":
        content = await service.party_insight(prompt=body.prompt, system=body.system)
    else:
        content = await service.budget_insight(
            budget=0, prompt=body.prompt, system=body.system
        )

    if not content:
        return ChatResponse(content=None, source="fallback")
    return ChatResponse(content=content, source="ai")
