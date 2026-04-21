"""Embedding model wrapper for RAG (sentence-transformers)."""
from typing import List

DEFAULT_MODEL = "all-MiniLM-L6-v2"


class Embedder:
    def __init__(self, model_name: str = DEFAULT_MODEL):
        self._model_name = model_name
        self._model = None

    def _ensure_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer  # type: ignore
            self._model = SentenceTransformer(self._model_name)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        self._ensure_model()
        return self._model.encode(texts, convert_to_numpy=True).tolist()

    def embed_query(self, query: str) -> List[float]:
        self._ensure_model()
        return self._model.encode([query], convert_to_numpy=True)[0].tolist()
