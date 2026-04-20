"""RAG pipeline: retrieve context from textbook and answer strictly from it.

This implementation is intentionally **LLM-free** (no Ollama) to avoid
local model RAM requirements and prevent out-of-syllabus hallucinations.
"""
from __future__ import annotations

from typing import List, Optional
import re

from backend.config import settings
from backend.rag.retriever import RAGRetriever
from backend.rag.embedder import Embedder


NO_CONTEXT_RESPONSE = "This question is not clearly answered in your Social Studies 10 textbook. Please check with your teacher or refer to your notes."


def _build_context(retrieved: List[dict]) -> str:
    parts = []
    for i, r in enumerate(retrieved, 1):
        ch = r.get("chapter_title") or r.get("chapter_id") or "Textbook"
        pg = r.get("page_start") or r.get("page_end")
        pg_str = f" (pages {pg})" if pg else ""
        parts.append(f"[Excerpt {i} - {ch}{pg_str}]\n{r.get('text', '')}")
    return "\n\n".join(parts)

def _sentences(text: str) -> list[str]:
    # Cheap sentence splitter for extractive answers
    parts = re.split(r"(?<=[.!?])\s+", (text or "").replace("\n", " ").strip())
    return [p.strip() for p in parts if len(p.strip()) > 0]

_BOILERPLATE_PATTERNS = [
    r"\bSCERT\b",
    r"\bTELANGANA\b",
    r"Government[’'`s]{0,2}\s+Gift\s+for\s+Students[’'`s]{0,2}\s+Progress",
    r"\bCHAPTER\s*\d+\b",
    r"\bFIG\.?\s*\d+(\.\d+)?\b",
    r"\bPROJECT\b",
]


def _is_boilerplate(s: str) -> bool:
    t = re.sub(r"\s+", " ", (s or "")).strip()
    if len(t) < 8:
        return True
    # Many PDF headers/footers are short, repeated, or page-number heavy
    if re.fullmatch(r"[\d\W_]+", t):
        return True
    for pat in _BOILERPLATE_PATTERNS:
        if re.search(pat, t, flags=re.IGNORECASE):
            return True
    # Strip common “running header” duplicates like: "India - Relief Features"
    if re.fullmatch(r"(India\s*-\s*Relief\s*Features)+", t, flags=re.IGNORECASE):
        return True
    return False


def _clean_sentence(s: str) -> str:
    t = re.sub(r"\s+", " ", (s or "")).strip()
    # Remove stray section numbers like "1.3.6" at ends
    t = re.sub(r"\b\d+(\.\d+){1,4}\b$", "", t).strip()
    # Remove duplicated hyphen bullets copied from PDF line breaks
    t = re.sub(r"^\-\s*", "", t).strip()
    return t


def _keywords(question: str) -> set[str]:
    # Keep only meaningful tokens
    q = (question or "").lower()
    tokens = re.findall(r"[a-zA-Z][a-zA-Z']{2,}", q)
    stop = {
        "what", "which", "when", "where", "why", "how", "explain", "describe", "define",
        "the", "and", "for", "with", "from", "into", "that", "this", "these", "those",
        "class", "social", "studies", "chapter",
    }
    return {t for t in tokens if t not in stop}


def _extractive_answer(question: str, retrieved: List[dict], max_sentences: int = 6) -> str:
    keys = _keywords(question)
    scored: list[tuple[int, str]] = []
    for r in retrieved:
        for s in _sentences(r.get("text", "")):
            s = _clean_sentence(s)
            if not s or _is_boilerplate(s):
                continue
            s_l = s.lower()
            score = sum(1 for k in keys if k in s_l)
            if score > 0:
                scored.append((score, s))
    scored.sort(key=lambda x: (-x[0], -len(x[1])))
    picked: list[str] = []
    seen: set[str] = set()
    for _, s in scored:
        norm = re.sub(r"\s+", " ", s.strip())
        if norm.lower() in seen:
            continue
        seen.add(norm.lower())
        picked.append(norm)
        if len(picked) >= max_sentences:
            break
    if not picked:
        # Fallback: return first few sentences of top excerpt
        top = retrieved[0].get("text", "")
        fallback = []
        for s in _sentences(top):
            s = _clean_sentence(s)
            if not s or _is_boilerplate(s):
                continue
            fallback.append(s)
            if len(fallback) >= max_sentences:
                break
        picked = fallback
    return "\n".join(f"- {p}" for p in picked if p)


class RAGService:
    def __init__(self):
        self._retriever = None

    def _get_retriever(self) -> RAGRetriever:
        if self._retriever is None:
            self._retriever = RAGRetriever(settings.vector_store_dir, Embedder())
        return self._retriever

    def answer(
        self,
        question: str,
        chapter_id: Optional[str] = None,
        period_id: Optional[str] = None,
        k: int = 5,
        score_threshold: float = 0.3,
    ) -> tuple[str, list[dict]]:
        """
        Returns (answer_text, list of source dicts with chapter_id, chapter_title, page_start, page_end).
        """
        retriever = self._get_retriever()
        chapter_filters = [chapter_id] if chapter_id else None
        try:
            retrieved = retriever.retrieve(
                question,
                chapter_filters=chapter_filters,
                k=k,
                score_threshold=score_threshold,
            )
        except Exception:
            return NO_CONTEXT_RESPONSE, []

        if not retrieved or not retrieved[0].get("text"):
            return NO_CONTEXT_RESPONSE, []

        # Textbook-only extractive answer (no Ollama / no hallucinations)
        answer = _extractive_answer(question, retrieved, max_sentences=6)

        sources = []
        seen = set()
        for r in retrieved:
            key = (r.get("chapter_id"), r.get("page_start"), r.get("page_end"))
            if key in seen:
                continue
            seen.add(key)
            sources.append({
                "chapter_id": r.get("chapter_id"),
                "chapter_title": r.get("chapter_title"),
                "page_start": r.get("page_start"),
                "page_end": r.get("page_end"),
            })
        return answer, sources
