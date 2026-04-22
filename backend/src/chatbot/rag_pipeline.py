"""
rag_pipeline.py
---------------
Core RAG pipeline for the Warif chatbot.
Handles retrieval from ChromaDB and LLM generation via Groq API.

Usage:
    from chatbot.rag_pipeline import ask

    answer = ask("My cucumber leaves are turning yellow")
    answer = ask("Is my greenhouse okay?", sensor_data=sensor_snapshot)
"""

import os
import re
import logging
from datetime import datetime
from typing import Optional

import chromadb
from chromadb.utils import embedding_functions
from groq import Groq

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Config — reads from environment variables ──────────────────────────────────
GROQ_API_KEY    = os.getenv("GROQ_API_KEY", "")
CHROMA_DB_PATH  = os.getenv("CHROMA_DB_PATH", "./chatbot/chroma_db")
COLLECTION_NAME = os.getenv("CHROMA_COLLECTION", "warif_knowledge")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "paraphrase-multilingual-mpnet-base-v2")
GROQ_MODEL      = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# ── System prompt ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT_TEMPLATE = """You are an expert agricultural assistant for the Warif smart greenhouse system.
You help farmers grow healthy cucumbers by answering questions accurately and practically.

LANGUAGE RULE — THIS IS MANDATORY:
{language_instruction}
Do NOT mix languages. Do NOT include any words from the other language. Every single word in your response must be in the specified language only.

FORMAT EVERY ANSWER LIKE THIS (strictly follow this structure):
1. One short sentence summarizing the situation or diagnosis.
2. A blank line.
3. Key points or recommendations as bullet lines — each starting with "• " (bullet + space).
   Keep each bullet to one short, actionable line. Maximum 5 bullets.
4. A blank line.
5. A final line starting with "✅ " giving the single most important next action.

Additional rules:
- When sensor data is provided, mention the actual values in the relevant bullets.
- Do not make up information not in the provided context.
- Never use markdown headers (##) or asterisks for bold — plain text only.
- Keep total answer under 120 words."""

LANGUAGE_INSTRUCTIONS = {
    "ar": "You MUST respond entirely in Arabic (العربية). Every word must be Arabic.",
    "en": "You MUST respond entirely in English. Every word must be English.",
}


# ── Initialize clients (called once at module load) ────────────────────────────
def _init_chroma() -> chromadb.Collection:
    """Load ChromaDB collection with the same embedding model used during indexing."""
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )
    client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    collection = client.get_collection(
        name=COLLECTION_NAME,
        embedding_function=ef
    )
    logger.info(f"ChromaDB loaded — {collection.count()} vectors in '{COLLECTION_NAME}'")
    return collection


def _init_groq() -> Groq:
    """Initialize Groq client."""
    if not GROQ_API_KEY:
        raise ValueError(
            "GROQ_API_KEY environment variable not set. "
            "Get a free key at https://console.groq.com"
        )
    return Groq(api_key=GROQ_API_KEY)


# Module-level singletons — initialized on first import
try:
    _collection = _init_chroma()
    _groq_client = _init_groq()
    logger.info("RAG pipeline initialized successfully.")
except Exception as e:
    logger.error(f"Failed to initialize RAG pipeline: {e}")
    _collection = None
    _groq_client = None


# ── Retrieval ──────────────────────────────────────────────────────────────────
def retrieve(query: str, n_results: int = 4) -> tuple[list, list, list]:
    """
    Retrieve top-k relevant chunks from ChromaDB for a given query.
    Returns (documents, metadatas, distances).
    """
    if _collection is None:
        raise RuntimeError("ChromaDB collection not initialized.")

    results = _collection.query(
        query_texts=[query],
        n_results=n_results
    )
    return (
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0]
    )


# ── Sensor context formatter ───────────────────────────────────────────────────
def format_sensor_context(sensor_data: Optional[dict]) -> str:
    """
    Format a sensor snapshot dict into a readable text block for the LLM prompt.
    In production this dict comes from your existing Warif IoT backend.
    """
    if not sensor_data:
        return "No live sensor data available."

    lines = []
    ts    = sensor_data.get("timestamp", datetime.now().isoformat())
    lines.append(f"Reading time  : {ts}")
    lines.append(f"Crop          : {sensor_data.get('crop', 'cucumber')} | "
                 f"Stage: {sensor_data.get('growth_stage', 'unknown')}")

    soil = sensor_data.get("soil", {})
    if soil:
        lines.append(f"Soil moisture : {soil.get('moisture_percent')}%   (optimal: 60-80%)")
        lines.append(f"Soil temp     : {soil.get('temperature_celsius')}°C (optimal: 20-30°C)")
        lines.append(f"Soil pH       : {soil.get('ph')}            (optimal: 6.0-6.8)")
        lines.append(f"Soil EC       : {soil.get('ec')} mS/cm      (optimal: 1.5-2.5)")

    air = sensor_data.get("air", {})
    if air:
        lines.append(f"Air temp      : {air.get('temperature_celsius')}°C (optimal day: 22-28°C)")
        lines.append(f"Humidity      : {air.get('humidity_percent')}%   (optimal: 70-85%)")
        lines.append(f"CO2           : {air.get('co2_ppm')} ppm      (optimal: 800-1200 ppm)")

    alerts = sensor_data.get("alerts", [])
    if alerts:
        lines.append("⚠ Active alerts: " + " | ".join(alerts))

    return "\n".join(lines)


# ── Prompt builder ─────────────────────────────────────────────────────────────
def build_prompt_messages(
    question: str,
    retrieved_chunks: list[str],
    sensor_data: Optional[dict],
    language: str = "ar"
) -> list[dict]:
    lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["ar"])
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(language_instruction=lang_instruction)

    sensor_block    = format_sensor_context(sensor_data)
    knowledge_block = "\n\n---\n\n".join(retrieved_chunks)

    user_content = (
        f"=== CURRENT GREENHOUSE CONDITIONS ===\n{sensor_block}\n\n"
        f"=== RELEVANT KNOWLEDGE ===\n{knowledge_block}\n\n"
        f"=== FARMER QUESTION ===\n{question}"
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_content}
    ]


# ── Main ask function ──────────────────────────────────────────────────────────
def ask(
    question: str,
    sensor_data: Optional[dict] = None,
    n_chunks: int = 4,
    max_tokens: int = 512,
    language: str = "ar",
    verbose: bool = False
) -> dict:
    """
    Full RAG pipeline — the main function called by chatbot_api.py.

    Args:
        question    : Farmer's question (Arabic or English)
        sensor_data : Live sensor snapshot dict from IoT backend (optional)
        n_chunks    : Number of knowledge chunks to retrieve
        max_tokens  : Max tokens for LLM response
        verbose     : Print debug info (retrieval distances etc.)

    Returns:
        dict with keys:
            answer      : str  — the generated answer
            sources     : list — source filenames of retrieved chunks
            distances   : list — retrieval distances (lower = more relevant)
            sensor_used : bool — whether sensor data was included
    """
    if _collection is None or _groq_client is None:
        return {
            "answer"      : "Chatbot service is not initialized. Check server logs.",
            "sources"     : [],
            "distances"   : [],
            "sensor_used" : False
        }

    # Step 1: Retrieve relevant chunks
    chunks_text, metas, distances = retrieve(question, n_results=n_chunks)
    sources = [m.get("source", "unknown") for m in metas]

    if verbose:
        logger.info(f"Query: {question}")
        for src, dist in zip(sources, distances):
            logger.info(f"  Retrieved: {src}  (distance: {dist:.4f})")

    # Step 2: Build prompt
    messages = build_prompt_messages(question, chunks_text, sensor_data, language)

    # Step 3: Call Groq API
    try:
        response = _groq_client.chat.completions.create(
            model       = GROQ_MODEL,
            messages    = messages,
            max_tokens  = max_tokens,
            temperature = 0.3,       # low temperature = factual, grounded answers
            top_p       = 0.9
        )
        answer = response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        answer = f"Error generating answer: {str(e)}"

    return {
        "answer"      : answer,
        "sources"     : sources,
        "distances"   : distances,
        "sensor_used" : sensor_data is not None
    }
