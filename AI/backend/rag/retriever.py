"""Retrieve relevant textbook chunks for a query (RAG retrieval)."""
from pathlib import Path
from typing import List, Optional

from .chunker import Chunk
from .embedder import Embedder


COLLECTION_NAME = "social10_textbook"


class RAGRetriever:
    def __init__(self, persist_dir: Path, embedder: Optional[Embedder] = None):
        self._persist_dir = persist_dir
        self._embedder = embedder or Embedder()
        self._client = None
        self._collection = None

    def _ensure_client(self):
        if self._client is not None:
            return
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings
            self._persist_dir.mkdir(parents=True, exist_ok=True)
            self._client = chromadb.PersistentClient(
                path=str(self._persist_dir),
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self._collection = self._client.get_collection(COLLECTION_NAME)
        except Exception:
            self._client = None
            self._collection = None

    def retrieve(
        self,
        query: str,
        chapter_filters: Optional[List[str]] = None,
        k: int = 5,
        score_threshold: Optional[float] = None,
    ) -> List[dict]:
        """
        Return top-k chunks with metadata.
        Each item: { "text", "page_start", "page_end", "chapter_id", "chapter_title", "plan_section", "score" }.
        """
        self._ensure_client()
        if self._collection is None:
            return []
        query_embedding = self._embedder.embed_query(query)
        n_results = max(k, 20)
        where = None
        if chapter_filters:
            where = {"chapter_id": {"$in": chapter_filters}}
        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        docs = results["documents"][0] if results["documents"] else []
        metadatas = results["metadatas"][0] if results["metadatas"] else []
        distances = results["distances"][0] if results["distances"] else []
        out = []
        for i, (doc, meta, dist) in enumerate(zip(docs, metadatas, distances)):
            if score_threshold is not None:
                # Chroma cosine distance: 0 = identical, 2 = opposite
                if dist > (1 - score_threshold) * 2:
                    continue
            out.append({
                "text": doc,
                "page_start": meta.get("page_start"),
                "page_end": meta.get("page_end"),
                "chapter_id": meta.get("chapter_id") or None,
                "chapter_title": meta.get("chapter_title") or None,
                "plan_section": meta.get("plan_section") or None,
                "score": 1 - (dist / 2.0) if dist is not None else None,
            })
        return out[:k]
