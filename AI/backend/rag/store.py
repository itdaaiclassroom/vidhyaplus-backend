"""Chroma vector store for textbook chunks."""
from pathlib import Path
from typing import List, Optional

from .chunker import Chunk
from .embedder import Embedder


COLLECTION_NAME = "social10_textbook"


def build_and_persist_store(
    chunks: List[Chunk],
    persist_dir: Path,
    embedder: Optional[Embedder] = None,
    collection_name: str = COLLECTION_NAME,
) -> None:
    """Build Chroma collection from chunks and persist to persist_dir."""
    import chromadb
    from chromadb.config import Settings as ChromaSettings

    embedder = embedder or Embedder()
    texts = [c.text for c in chunks]
    embeddings = embedder.embed_documents(texts)

    client = chromadb.PersistentClient(
        path=str(persist_dir),
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    # Remove existing collection if present so we can rebuild
    try:
        client.delete_collection(collection_name)
    except Exception:
        pass
    collection = client.create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )
    ids = [f"chunk_{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "page_start": c.page_start,
            "page_end": c.page_end,
            "chapter_id": c.chapter_id or "",
            "chapter_title": c.chapter_title or "",
            "plan_section": c.plan_section or "",
        }
        for c in chunks
    ]
    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=texts,
        metadatas=metadatas,
    )
