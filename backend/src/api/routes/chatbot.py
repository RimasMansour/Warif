"""
Chatbot routes for Warif backend
RAG-based chatbot for greenhouse guidance and Q&A
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.chatbot.chatbot_api import ChatbotAPI

router = APIRouter()

# Initialize chatbot
chatbot = ChatbotAPI()


class ChatMessage(BaseModel):
    question: str
    language: str = "ar"  # ar (Arabic) or en (English)


class ChatResponse(BaseModel):
    answer: str
    sources: list = []
    language: str


@router.post("/chat", response_model=ChatResponse)
async def chat(message: ChatMessage):
    """
    Send a question to the chatbot and get an AI-powered response
    """
    try:
        response = chatbot.ask(message.question, language=message.language)
        return ChatResponse(
            answer=response["answer"],
            sources=response.get("sources", []),
            language=message.language
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")


@router.get("/health")
async def chatbot_health():
    """Check chatbot service health"""
    return {"status": "healthy", "service": "chatbot"}
