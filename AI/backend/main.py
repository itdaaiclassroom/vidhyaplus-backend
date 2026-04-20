import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .schemas import (
    HealthResponse,
    ChatRequest,
    ChatResponse,
    ReferenceRequest,
    ReferenceResponse,
    SourceMetadata,
)
from .services.rag_service import RAGService
from .services.reference_service import get_references


def create_app() -> FastAPI:
    app = FastAPI(title="Social Studies 10 RAG Tutor API")
    rag = RAGService()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", response_model=HealthResponse)
    async def health_check() -> HealthResponse:
        return HealthResponse(status="ok")

    @app.get("/api/chapters")
    async def list_chapters():
        p = Path(__file__).parent / "data" / "chapters.json"
        if not p.exists():
            return []
        return json.loads(p.read_text(encoding="utf-8"))

    @app.post("/api/chat", response_model=ChatResponse)
    async def chat(req: ChatRequest) -> ChatResponse:
        answer, sources = rag.answer(
            question=req.question,
            chapter_id=req.chapter_id,
            period_id=req.period_id,
        )
        return ChatResponse(
            answer=answer,
            sources=[SourceMetadata(**s) for s in sources],
            used_chapter_id=req.chapter_id,
            used_period_id=req.period_id,
        )

    @app.post("/api/references", response_model=ReferenceResponse)
    async def references(req: ReferenceRequest) -> ReferenceResponse:
        yt, res = get_references(
            question=req.question,
            chapter_id=req.chapter_id,
            max_youtube=5,
            max_resources=5,
        )
        return ReferenceResponse(youtube=yt, resources=res)

    @app.post("/admin/rebuild_index")
    async def rebuild_index():
        if not settings.textbook_pdf.exists():
            raise HTTPException(404, f"Textbook not found: {settings.textbook_pdf}")
        from .rag.loader import load_pdf_pages
        from .rag.chunker import chunk_pages
        from .rag.embedder import Embedder
        from .rag.store import build_and_persist_store
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        settings.vector_store_dir.mkdir(parents=True, exist_ok=True)
        pages = load_pdf_pages(settings.textbook_pdf)
        chunks = chunk_pages(pages)
        build_and_persist_store(chunks, settings.vector_store_dir)
        return {"status": "ok", "chunks": len(chunks)}

    return app


app = create_app()

