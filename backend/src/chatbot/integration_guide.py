"""
HOW TO INTEGRATE THE CHATBOT INTO YOUR EXISTING WARIF main.py
--------------------------------------------------------------
Add these lines to your existing FastAPI app file.
"""

# ── 1. Add these imports at the top of your main.py ───────────────────────────

from dotenv import load_dotenv
load_dotenv()  # loads GROQ_API_KEY and other vars from .env file

from chatbot.chatbot_api import router as chatbot_router


# ── 2. Mount the chatbot router on your existing app ──────────────────────────
# (add this after you create your FastAPI app instance)

# Your existing app — already in your code:
# app = FastAPI(title="Warif System")

app.include_router(
    chatbot_router,
    prefix="/chatbot",
    tags=["Chatbot"]
)


# ── 3. That's it. Your new endpoints will be: ─────────────────────────────────
#
#   POST  /chatbot/ask          — main chat
#   GET   /chatbot/health       — health check
#   GET   /chatbot/test-sensor  — test with simulated sensor data
#
# View interactive docs at: http://localhost:8000/docs


# ── 4. Example: connecting real sensor data ────────────────────────────────────
#
# In your existing sensor route, you can call the chatbot directly:
#
# from chatbot.rag_pipeline import ask
#
# @app.post("/sensor/update")
# async def update_sensor(data: SensorReading):
#     # ... your existing sensor storage logic ...
#
#     # If there are active alerts, auto-generate a recommendation
#     if data.alerts:
#         result = ask(
#             question    = "What should I do given the current greenhouse alerts?",
#             sensor_data = data.dict()
#         )
#         # store or push result["answer"] to dashboard
