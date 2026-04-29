"""AI API entry: CORS, .env, chatbot + ingest + recommendations + segmentation routers."""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

# Load shared embedding model first (used by both chatbot and recommendations)
import shared_embeddings  # noqa: F401

from chatbot import router as chatbot_router
from recommendations import router as recommendations_router
from segmentation import router as segmentation_router
from ingest import router as ingest_router, migrate_legacy_index

app = FastAPI(
    title="VidhyaPlus AI Teacher API",
    description="Real-time AI teacher assistant: multi-doc RAG, quiz generation, and content recommendations.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chatbot_router)
app.include_router(ingest_router)
app.include_router(recommendations_router)
app.include_router(segmentation_router)


def _validate_ai_env() -> None:
    yt_key = (os.environ.get("YOUTUBE_API_KEY") or "").strip()
    require_yt = (os.environ.get("REQUIRE_YOUTUBE_API") or "").strip().lower() == "true"
    if not yt_key:
        msg = "[ai_model] YOUTUBE_API_KEY is not set. Recommendations will use web-search fallback."
        if require_yt:
            raise RuntimeError(f"{msg} Set YOUTUBE_API_KEY in backend/ai_model/.env or unset REQUIRE_YOUTUBE_API.")
        print(msg)


_validate_ai_env()

# Migrate legacy single-file index into new multi-doc layout (runs once)
migrate_legacy_index()


@app.get("/health")
def health():
    """Health check — also reports doc count and Ollama status."""
    from chatbot import document_registry, ollama_available
    return {
        "ok": True,
        "doc_count": document_registry.doc_count,
        "ollama_available": ollama_available(),
    }
