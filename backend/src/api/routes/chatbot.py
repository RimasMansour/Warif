# backend/src/api/routes/chatbot.py
"""
Chatbot Routes — Warif API (Stub)
===================================
Placeholder endpoints for the future Arabic conversational assistant:
  - POST /chatbot/ask    : ask a question (currently returns stub response)
  - GET  /chatbot/health : service health check

Note: Full RAG-based chatbot implementation is planned for a future release.
The chatbot will use LLM + farm sensor context to answer farmer questions in Arabic.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

class ChatRequest(BaseModel):
    question: str
    sensor_data: Optional[dict] = None
    language: str = "ar"
    n_chunks: int = 4

class ChatResponse(BaseModel):
    answer: str
    sources: List[str] = []
    distances: List[float] = []
    sensor_used: bool = False

@router.post("/ask", response_model=ChatResponse)
async def chat(request: ChatRequest):
    return ChatResponse(
        answer="الخدمة غير متاحة حالياً في وضع التطوير المحلي.",
        sensor_used=False
    )

@router.get("/health")
async def health():
    return {"status": "ok", "service": "chatbot", "mode": "stub"}
