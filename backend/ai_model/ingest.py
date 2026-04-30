"""
ingest.py  —  Multi-document ingestion router for FastAPI.

Endpoints:
  POST /ingest          — Upload a PDF file or provide a URL to ingest
  GET  /documents       — List all ingested documents
  DELETE /documents/:id — Remove a document (index + chunks)

Documents are stored in:
  backend/ai_model/indexes/<doc_id>.faiss
  backend/ai_model/indexes/<doc_id>.pkl
  backend/ai_model/indexes/manifest.json
"""

import json
import os
import pickle
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Storage layout
# ---------------------------------------------------------------------------
_HERE = Path(__file__).resolve().parent
INDEXES_DIR = _HERE / "indexes"
MANIFEST_PATH = INDEXES_DIR / "manifest.json"
INDEXES_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# Manifest helpers (thread-safe enough for single-worker dev; use file lock
# in production multi-worker deployments)
# ---------------------------------------------------------------------------

def _load_manifest() -> list[dict]:
    if not MANIFEST_PATH.exists():
        return []
    try:
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_manifest(docs: list[dict]) -> None:
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)


def _add_to_manifest(doc: dict) -> None:
    docs = _load_manifest()
    docs = [d for d in docs if d.get("id") != doc["id"]]  # upsert
    docs.append(doc)
    _save_manifest(docs)


def _remove_from_manifest(doc_id: str) -> bool:
    docs = _load_manifest()
    new_docs = [d for d in docs if d.get("id") != doc_id]
    if len(new_docs) == len(docs):
        return False
    _save_manifest(new_docs)
    return True


# ---------------------------------------------------------------------------
# Core indexing logic  (shared with build_index.py path)
# ---------------------------------------------------------------------------

def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    from pypdf import PdfReader
    import io
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages_text = []
    for page in reader.pages:
        pages_text.append(page.extract_text() or "")
    return "\n".join(pages_text)


def _extract_url_text(url: str) -> tuple[str, str]:
    """Download PDF or scrape HTML from URL. Returns (text, detected_label)."""
    import httpx
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    # verify=False handles invalid SSL certs on government websites
    resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=60, verify=False)
    resp.raise_for_status()
    ct = resp.headers.get("content-type", "")
    if "pdf" in ct or url.lower().endswith(".pdf"):
        text = _extract_pdf_text(resp.content)
        label = Path(url.rstrip("/").split("/")[-1]).stem or "document"
        return text, label
    # HTML fallback — strip tags simply
    import re
    html = resp.text
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s{2,}", " ", text).strip()
    label = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE)
    label = (label.group(1).strip() if label else url.split("/")[-1] or "webpage")[:80]
    return text, label


def _build_faiss_index(chunks: list[str]):
    """Embed chunks and return (faiss.Index, np.ndarray embeddings)."""
    import faiss
    from shared_embeddings import embedding_model

    embeddings = embedding_model.encode(chunks, show_progress_bar=False)
    embeddings = np.array(embeddings).astype("float32")
    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)
    return index, embeddings


def ingest_bytes(
    content: bytes,
    label: str,
    source_type: str = "pdf",
    source_url: str = "",
    doc_id: str | None = None,
) -> dict:
    """
    Core ingestion function. Builds FAISS index from raw bytes of a PDF.
    Returns manifest entry dict.
    """
    import faiss

    doc_id = doc_id or str(uuid.uuid4())[:8]
    print(f"[ingest] Processing '{label}' (id={doc_id}, type={source_type})")

    text = _extract_pdf_text(content)
    if not text.strip():
        raise ValueError("Could not extract any text from the PDF. Is it a scanned image-only PDF?")

    chunks = _chunk_text(text)
    print(f"[ingest] {len(chunks)} chunks created.")

    index, _ = _build_faiss_index(chunks)

    faiss_path = INDEXES_DIR / f"{doc_id}.faiss"
    chunks_path = INDEXES_DIR / f"{doc_id}.pkl"
    faiss.write_index(index, str(faiss_path))
    with open(chunks_path, "wb") as f:
        pickle.dump(chunks, f)

    entry = {
        "id": doc_id,
        "label": label,
        "source_type": source_type,
        "source_url": source_url,
        "chunk_count": len(chunks),
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    _add_to_manifest(entry)
    print(f"[ingest] ✅ Saved index for '{label}' — {len(chunks)} chunks.")
    return entry


def ingest_url_doc(url: str, label: str | None = None, doc_id: str | None = None) -> dict:
    """Ingest from a URL (PDF link or webpage)."""
    import faiss

    doc_id = doc_id or str(uuid.uuid4())[:8]
    text, detected_label = _extract_url_text(url)
    label = label or detected_label
    print(f"[ingest] URL '{url}' → '{label}' (id={doc_id})")

    if not text.strip():
        raise ValueError("Could not extract text from the URL.")

    chunks = _chunk_text(text)
    print(f"[ingest] {len(chunks)} chunks from URL.")

    index, _ = _build_faiss_index(chunks)

    faiss_path = INDEXES_DIR / f"{doc_id}.faiss"
    chunks_path = INDEXES_DIR / f"{doc_id}.pkl"
    faiss.write_index(index, str(faiss_path))
    with open(chunks_path, "wb") as f:
        pickle.dump(chunks, f)

    entry = {
        "id": doc_id,
        "label": label,
        "source_type": "url",
        "source_url": url,
        "chunk_count": len(chunks),
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    _add_to_manifest(entry)
    print(f"[ingest] ✅ Saved URL index for '{label}'.")
    return entry


# ---------------------------------------------------------------------------
# FastAPI Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["ingest"])


class UrlIngestBody(BaseModel):
    url: str
    label: Optional[str] = None


@router.post("/ingest")
async def ingest_document(request: Request):
    """
    Smart ingest endpoint — auto-detects Content-Type:

    • multipart/form-data  →  fields: file (PDF), label (text), url (text)
    • application/json     →  body: { "url": "...", "label": "..." }

    Examples:
      Upload file  → form-data: file=<pdf>, label="Science Class 8"
      URL (form)   → form-data: url="https://...", label="NCERT"
      URL (JSON)   → raw JSON: { "url": "https://...", "label": "NCERT" }
    """
    from chatbot import document_registry

    content_type = request.headers.get("content-type", "")

    # ── JSON body path (application/json) ────────────────────────────────────
    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(400, "Invalid JSON body.")

        url = (body.get("url") or "").strip()
        label = (body.get("label") or "").strip() or None

        if not url:
            raise HTTPException(
                400,
                "JSON body must include 'url'. Example: { \"url\": \"https://example.com/file.pdf\", \"label\": \"My Doc\" }"
            )
        try:
            entry = ingest_url_doc(url, label=label)
        except Exception as e:
            raise HTTPException(422, f"URL ingestion failed: {str(e)}")
        document_registry.reload()
        return {"ok": True, "document": entry}

    # ── Multipart / form-data path ────────────────────────────────────────────
    try:
        form = await request.form()
    except Exception:
        raise HTTPException(
            400,
            "Could not parse request. Send either: "
            "(1) multipart/form-data with 'file' or 'url' field, or "
            "(2) application/json with { url, label }."
        )

    file: Optional[UploadFile] = form.get("file")      # type: ignore
    url_field: str = (form.get("url") or "").strip()   # type: ignore
    label_field: str = (form.get("label") or "").strip() or None  # type: ignore

    # File upload
    if file is not None and hasattr(file, "read"):
        content = await file.read()
        if not content:
            raise HTTPException(400, "Uploaded file is empty.")
        doc_label = label_field or Path(file.filename or "document").stem
        try:
            entry = ingest_bytes(content, doc_label, source_type="pdf")
        except Exception as e:
            raise HTTPException(422, f"Ingestion failed: {str(e)}")
        document_registry.reload()
        return {"ok": True, "document": entry}

    # URL as a form field
    if url_field:
        try:
            entry = ingest_url_doc(url_field, label=label_field)
        except Exception as e:
            raise HTTPException(422, f"URL ingestion failed: {str(e)}")
        document_registry.reload()
        return {"ok": True, "document": entry}

    raise HTTPException(
        400,
        "Nothing to ingest. Send either: "
        "(1) form-data with 'file' (PDF binary) or 'url' field, or "
        "(2) JSON body with { \"url\": \"https://...\", \"label\": \"optional name\" }."
    )


@router.post("/ingest/url")
async def ingest_url_endpoint(body: UrlIngestBody):
    """
    JSON-only URL ingestion endpoint.
    Body: { "url": "https://...", "label": "optional" }
    """
    from chatbot import document_registry
    url = (body.url or "").strip()
    if not url:
        raise HTTPException(400, "'url' field is required.")
    try:
        entry = ingest_url_doc(url, label=body.label)
    except Exception as e:
        raise HTTPException(422, f"URL ingestion failed: {str(e)}")
    document_registry.reload()
    return {"ok": True, "document": entry}


@router.get("/documents")
def list_documents():
    """List all ingested documents in the knowledge base."""
    docs = _load_manifest()
    return {"documents": docs, "count": len(docs)}


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    """Remove a document from the knowledge base (deletes index + chunks)."""
    from chatbot import document_registry

    removed = _remove_from_manifest(doc_id)
    # Delete files
    for ext in [".faiss", ".pkl"]:
        p = INDEXES_DIR / f"{doc_id}{ext}"
        if p.exists():
            p.unlink()

    document_registry.reload()
    if not removed:
        raise HTTPException(404, f"Document '{doc_id}' not found.")
    return {"ok": True, "deleted_id": doc_id}


# ---------------------------------------------------------------------------
# Migration helper: import existing syllabus_vectors.faiss into new layout
# ---------------------------------------------------------------------------

def migrate_legacy_index():
    """
    If the old single-file syllabus_vectors.faiss + chunks.pkl exist,
    migrate them into the new per-document indexes/ directory.
    Called once at startup from api.py.
    """
    old_faiss = _HERE / "syllabus_vectors.faiss"
    old_chunks = _HERE / "chunks.pkl"
    if not (old_faiss.exists() and old_chunks.exists()):
        return

    manifest = _load_manifest()
    already_migrated = any(d.get("id") == "legacy_0" for d in manifest)
    if already_migrated:
        return

    print("[ingest] Migrating legacy syllabus_vectors.faiss → indexes/legacy_0.faiss")
    import faiss
    try:
        idx = faiss.read_index(str(old_faiss))
        faiss.write_index(idx, str(INDEXES_DIR / "legacy_0.faiss"))
        with open(old_chunks, "rb") as f:
            chunks = pickle.load(f)
        with open(INDEXES_DIR / "legacy_0.pkl", "wb") as f:
            pickle.dump(chunks, f)
        entry = {
            "id": "legacy_0",
            "label": "Syllabus (Legacy)",
            "source_type": "pdf",
            "source_url": "",
            "chunk_count": len(chunks),
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        _add_to_manifest(entry)
        print(f"[ingest] ✅ Legacy index migrated ({len(chunks)} chunks).")
    except Exception as e:
        print(f"[ingest] Legacy migration skipped: {e}")
