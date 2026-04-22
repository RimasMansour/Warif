"""
main.py — Warif Smart Greenhouse FastAPI backend
Run with: uvicorn main:app --reload  (from the src/ directory)
"""

import sys
import os

# Make sure .env from project root is loaded
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from chatbot.chatbot_api import router as chatbot_router

app = FastAPI(
    title="Warif Smart Greenhouse API",
    description="Backend API for the Warif greenhouse monitoring and chatbot system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chatbot_router, prefix="/chatbot", tags=["Chatbot"])


@app.get("/", tags=["Root"])
async def root():
    return {"message": "Warif Smart Greenhouse API is running", "docs": "/docs"}
