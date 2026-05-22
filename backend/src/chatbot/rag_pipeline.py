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

import logging
import os

from pathlib import Path
from typing import Optional

import chromadb
from chromadb.utils import embedding_functions
from dotenv import load_dotenv
from groq import Groq

_BACKEND_ROOT = Path(__file__).parent.parent.parent
load_dotenv(_BACKEND_ROOT / ".env")

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Config — reads from environment variables ──────────────────────────────────
GROQ_API_KEY    = os.getenv("GROQ_API_KEY", "")
COLLECTION_NAME = os.getenv("CHROMA_COLLECTION", "warif_arabic")

# Resolve CHROMA_DB_PATH: relative paths are resolved from the backend root
_raw_chroma = os.getenv("CHROMA_DB_PATH", "")
if not _raw_chroma:
    CHROMA_DB_PATH = str(Path(__file__).parent / "chroma_db_warif_arabic")
elif Path(_raw_chroma).is_absolute():
    CHROMA_DB_PATH = _raw_chroma
else:
    CHROMA_DB_PATH = str((_BACKEND_ROOT / _raw_chroma).resolve())
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "CAMeL-Lab/bert-base-arabic-camelbert-mix")
GROQ_MODEL      = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# ── System prompt ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT_TEMPLATE = """You are an expert agricultural assistant for the Warif smart greenhouse system.
You help farmers manage their greenhouse and crops by answering questions accurately.

LANGUAGE RULE — THIS IS MANDATORY:
{language_instruction}
Do NOT mix languages. Do NOT include any words from the other language. Every single word in your response must be in the specified language only.

UNINTELLIGIBLE INPUT RULE — HIGHEST PRIORITY:
If the farmer's question is random characters, gibberish, keyboard mashing, or completely unrelated to farming, greenhouses, plants, or agriculture — respond ONLY with a single polite sentence asking them to clarify. No bullets or ✅ in this case.

KNOWLEDGE RULE:
Base all agricultural advice strictly on the RELEVANT KNOWLEDGE section provided to you. Do not invent thresholds, ranges, or recommendations that are not supported by the retrieved knowledge. If the retrieved knowledge does not cover the question, say so honestly.

SENSOR DATA RULE:
Use the current greenhouse readings as context when answering. Only describe a reading as problematic if the retrieved knowledge indicates it is outside an acceptable range. Alerts labeled as sensor hardware issues (عالق، شذوذ، قراءة مفاجئة) indicate a device malfunction — not a crop or environmental problem. Only mention them if the farmer asks about equipment.

ANSWER GUIDELINES:
- Answer the specific question asked. Be direct and practical.
- Use bullet lines starting with "• " for lists of points or recommendations.
- Mention actual sensor values when they are relevant to the question.
- Never use markdown headers (##) or asterisks for bold — plain text only.
- Keep answers under 160 words unless the question requires more detail."""

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


_collection = None
_groq_client = None

def get_collection():
    global _collection
    if _collection is None:
        try:
            _collection = _init_chroma()
        except Exception as e:
            logger.error(f"ChromaDB init failed: {e}")
            _collection = None
    return _collection


def get_groq_client():
    global _groq_client
    if _groq_client is None:
        try:
            _groq_client = _init_groq()
        except Exception as e:
            logger.error(f"Groq init failed: {e}")
            _groq_client = None
    return _groq_client


# ── Retrieval ──────────────────────────────────────────────────────────────────
def retrieve(query: str, n_results: int = 4) -> tuple[list, list, list]:
    """
    Retrieve top-k relevant chunks from ChromaDB for a given query.
    Returns (documents, metadatas, distances).
    """
    col = get_collection()
    if col is None:
        raise RuntimeError("ChromaDB collection not initialized.")

    results = col.query(
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
    if not sensor_data:
        return "No live sensor data available."

    lines = []
    lines.append(f"Crop: {sensor_data.get('crop', 'cucumber')}")

    soil = sensor_data.get("soil", {})
    if soil:
        if soil.get("moisture_percent")    is not None: lines.append(f"Soil moisture    : {soil['moisture_percent']}%  (optimal: 60-80%)")
        if soil.get("temperature_celsius") is not None: lines.append(f"Soil temperature : {soil['temperature_celsius']}°C (optimal: 20-30°C)")
        if soil.get("ph")                  is not None: lines.append(f"Soil pH          : {soil['ph']}  (optimal: 6.0-6.8)")
        if soil.get("ec")                  is not None: lines.append(f"Soil EC          : {soil['ec']} mS/cm (optimal: 1.5-2.5)")

    air = sensor_data.get("air", {})
    if air:
        if air.get("temperature_celsius") is not None: lines.append(f"Air temperature  : {air['temperature_celsius']}°C (optimal: 22-28°C)")
        if air.get("humidity_percent")    is not None: lines.append(f"Air humidity     : {air['humidity_percent']}%  (optimal: 70-85%)")
        if air.get("co2_ppm")             is not None: lines.append(f"CO2              : {air['co2_ppm']} ppm (optimal: 800-1200)")

    alerts = sensor_data.get("alerts", [])
    if alerts:
        lines.append("\nActive agricultural alerts:")
        for a in alerts:
            lines.append(f"  • {a}")

    return "\n".join(lines)


# ── Prompt builder ─────────────────────────────────────────────────────────────
def build_prompt_messages(
    question: str,
    retrieved_chunks: list[str],
    sensor_data: Optional[dict],
    language: str = "ar",
    history: list[dict] | None = None,
) -> list[dict]:
    lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["ar"])
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(language_instruction=lang_instruction)

    sensor_block    = format_sensor_context(sensor_data)
    knowledge_block = "\n\n---\n\n".join(retrieved_chunks)

    # Current question always carries fresh sensor context and retrieved knowledge
    current_user_content = (
        f"=== CURRENT GREENHOUSE CONDITIONS ===\n{sensor_block}\n\n"
        f"=== RELEVANT KNOWLEDGE ===\n{knowledge_block}\n\n"
        f"=== FARMER QUESTION ===\n{question}"
    )

    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    # Previous turns: bare text only — sensor context is always injected fresh on
    # the current question so we don't duplicate it in every historical message.
    # Cap at 10 messages (5 turns) to keep prompt size reasonable.
    if history:
        for msg in history[-10:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": current_user_content})
    return messages


# ── Main ask function ──────────────────────────────────────────────────────────
def ask(
    question: str,
    sensor_data: Optional[dict] = None,
    n_chunks: int = 4,
    max_tokens: int = 768,
    language: str = "ar",
    history: list[dict] | None = None,
    verbose: bool = False
) -> dict:
    """
    Full RAG pipeline — the main function called by chatbot_api.py.

    Args:
        question    : Farmer's question (Arabic or English)
        sensor_data : Live sensor snapshot dict fetched from the DB (optional)
        n_chunks    : Number of knowledge chunks to retrieve
        max_tokens  : Max tokens for LLM response
        history     : Previous conversation turns [{role, content}, ...]
        verbose     : Print debug info (retrieval distances etc.)

    Returns:
        dict with keys:
            answer      : str  — the generated answer
            sources     : list — source filenames of retrieved chunks
            distances   : list — retrieval distances (lower = more relevant)
            sensor_used : bool — whether sensor data was included
    """
    col = get_collection()
    groq_client = get_groq_client()

    if col is None or groq_client is None:
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
    messages = build_prompt_messages(question, chunks_text, sensor_data, language, history)

    # Step 3: Call Groq API
    try:
        response = groq_client.chat.completions.create(
            model       = GROQ_MODEL,
            messages    = messages,
            max_tokens  = max_tokens,
            temperature = 0.6,
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
