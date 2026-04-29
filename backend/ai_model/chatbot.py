"""
chatbot.py  —  Multi-document RAG chatbot + quiz generator.

Key changes vs v1:
  - DocumentRegistry: loads ALL indexes in indexes/ directory, searches across all of them.
  - Hot-reload: ingest.py calls document_registry.reload() after adding/removing a doc.
  - Human-teacher prompt: warm, encouraging, step-by-step, age-appropriate.
  - Quiz: configurable num_questions (1-30), richer parsing.
  - /ask now returns source_docs so frontend can show which doc the answer came from.
"""

import os
import requests
from functools import lru_cache
from pathlib import Path
from typing import Optional, List
import threading
import pickle

from fastapi import APIRouter
from pydantic import BaseModel


_HERE = Path(__file__).resolve().parent
INDEXES_DIR = _HERE / "indexes"
INDEXES_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# DocumentRegistry — loads and searches across ALL per-doc FAISS indexes
# ---------------------------------------------------------------------------

class DocumentRegistry:
    """Thread-safe registry of all ingested FAISS indexes."""

    def __init__(self):
        self._lock = threading.RLock()
        self._entries: list[dict] = []   # {id, faiss_index, chunks, label}
        self.reload()

    def reload(self):
        """(Re)load all *.faiss + *.pkl pairs from indexes/."""
        try:
            import faiss
            import numpy as np
        except ImportError:
            print("[chatbot] faiss not installed — RAG disabled.")
            return

        new_entries = []
        for faiss_path in sorted(INDEXES_DIR.glob("*.faiss")):
            doc_id = faiss_path.stem
            chunks_path = INDEXES_DIR / f"{doc_id}.pkl"
            if not chunks_path.exists():
                continue
            try:
                idx = faiss.read_index(str(faiss_path))
                with open(chunks_path, "rb") as f:
                    chunks = pickle.load(f)
                # Try to get label from manifest
                label = doc_id
                new_entries.append({
                    "id": doc_id,
                    "index": idx,
                    "chunks": chunks,
                    "label": label,
                })
                print(f"[chatbot] Loaded index: {doc_id} ({len(chunks)} chunks)")
            except Exception as e:
                print(f"[chatbot] Failed to load {doc_id}: {e}")

        # Load labels from manifest
        import json
        manifest_path = INDEXES_DIR / "manifest.json"
        if manifest_path.exists():
            try:
                with open(manifest_path, "r", encoding="utf-8") as f:
                    manifest = json.load(f)
                label_map = {d["id"]: d.get("label", d["id"]) for d in manifest}
                for e in new_entries:
                    e["label"] = label_map.get(e["id"], e["id"])
            except Exception:
                pass

        with self._lock:
            self._entries = new_entries

        total_chunks = sum(e["chunks"].__len__() for e in new_entries)
        print(f"[chatbot] DocumentRegistry ready: {len(new_entries)} docs, {total_chunks} total chunks.")

    def retrieve_chunks(self, query: str, k: int = 5) -> list[tuple[str, str]]:
        """
        Search ALL indexes for the query.
        Returns list of (chunk_text, source_label) sorted by relevance.
        """
        import numpy as np
        from shared_embeddings import embedding_model

        with self._lock:
            entries = list(self._entries)

        if not entries:
            return []

        q_emb = embedding_model.encode([query], show_progress_bar=False)
        q_emb = np.array(q_emb).astype("float32")

        results = []  # (distance, chunk_text, label)
        per_doc_k = max(3, k)
        for entry in entries:
            idx = entry["index"]
            chunks = entry["chunks"]
            label = entry["label"]
            if idx.ntotal == 0 or not chunks:
                continue
            actual_k = min(per_doc_k, idx.ntotal)
            D, I = idx.search(q_emb, actual_k)
            for dist, ci in zip(D[0], I[0]):
                if 0 <= ci < len(chunks):
                    results.append((float(dist), chunks[ci], label))

        # Sort by distance ascending (lower = more relevant for L2)
        results.sort(key=lambda x: x[0])
        # Deduplicate by chunk prefix
        seen = set()
        deduped = []
        for dist, chunk, label in results:
            key = chunk[:80].lower().strip()
            if key in seen:
                continue
            seen.add(key)
            deduped.append((chunk, label))
            if len(deduped) >= k:
                break

        return deduped

    @property
    def doc_count(self) -> int:
        with self._lock:
            return len(self._entries)


# Global registry — loaded once at startup, hot-reloaded on ingest
document_registry = DocumentRegistry()


# ---------------------------------------------------------------------------
# LLM setup (Ollama preferred, local HF model as fallback)
# ---------------------------------------------------------------------------

_model_name = (os.environ.get("CHATBOT_MODEL") or "distilgpt2").strip()
_preferred_task = (os.environ.get("CHATBOT_TASK") or "text-generation").strip()
_ollama_model = (os.environ.get("OLLAMA_MODEL") or "mistral").strip()

llm = None
llm_task = None

print(f"[chatbot] Loading fallback LLM ({_model_name})...")
try:
    from transformers import pipeline
    llm_task = _preferred_task
    llm = pipeline(llm_task, model=_model_name)
    print(f"[chatbot] Fallback LLM ready: {_model_name}")
except Exception as e:
    print(f"[chatbot] Fallback LLM failed to load: {str(e)[:120]}")
    try:
        from transformers import pipeline
        llm_task = "text-generation"
        fallback_model = (os.environ.get("CHATBOT_FALLBACK_MODEL") or "distilgpt2").strip()
        llm = pipeline(llm_task, model=fallback_model)
        print(f"[chatbot] Secondary fallback LLM: {fallback_model}")
    except Exception:
        llm = None
        llm_task = None
        print("[chatbot] No fallback LLM available. Will use Ollama only.")


# ---------------------------------------------------------------------------
# Ollama helper
# ---------------------------------------------------------------------------

def call_ollama(prompt: str, model: str | None = None, max_tokens: int = 400) -> Optional[str]:
    """Call local Ollama API. Returns None if Ollama is not running."""
    model = model or _ollama_model
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_predict": max_tokens,
                    "temperature": 0.7,
                    "top_p": 0.9,
                }
            },
            timeout=60,
        )
        if response.status_code == 200:
            result = response.json().get("response", "")
            return result.strip() if result else None
    except Exception:
        pass
    return None


def ollama_available() -> bool:
    """Quick check if Ollama is reachable."""
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Text cleaning
# ---------------------------------------------------------------------------

def _clean_answer(text: str) -> str:
    if not text or not text.strip():
        return text
    text = text.replace("\x0c", " ").replace("\uFFFD", " ").strip()
    # Remove repeated "Answer:" prefix
    if "Answer:" in text:
        text = text.split("Answer:")[-1].strip()
    # Deduplicate sentences
    seen = set()
    out = []
    for part in text.replace("\n\n", "\n").split("\n"):
        part = part.strip()
        if not part or part.isdigit():
            continue
        key = part[:80].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(part)
    result = "\n\n".join(out).strip()
    # Trim if suspiciously long
    if len(result) > 1200:
        result = result[:1200].rsplit(".", 1)[0] + "."
    return result or text[:800].strip()


# ---------------------------------------------------------------------------
# Core answer generation
# ---------------------------------------------------------------------------

def generate_answer(
    question: str,
    topic: Optional[str] = None,
    subject: Optional[str] = None,
    chapter: Optional[str] = None,
) -> tuple[str, list[str]]:
    """
    Generate an answer using RAG + Ollama/LLM.
    Returns (answer_text, list_of_source_doc_labels).
    """
    # Enriched retrieval query
    retrieval_query = question
    if (topic or chapter) and len(question) < 40:
        retrieval_query = f"{subject or ''} {chapter or ''} {topic or ''}: {question}".strip()

    results = document_registry.retrieve_chunks(retrieval_query, k=6)
    if not results and topic:
        results = document_registry.retrieve_chunks(topic, k=4)

    source_labels = list(dict.fromkeys(label for _, label in results))
    context = "\n\n".join(chunk for chunk, _ in results[:5])[:2500] if results else ""

    if not context:
        context = f"Subject: {subject or 'General'}. Chapter: {chapter or 'General'}. Topic: {topic or question}."
        source_labels = ["general knowledge"]

    # Human teacher system prompt
    system_prompt = f"""You are an excellent, caring, and enthusiastic teacher helping a student.
Your style: warm, encouraging, clear, and concise — like a real classroom teacher.
Subject: {subject or 'General Science'}
Chapter: {chapter or 'General'}
Topic: {topic or 'General'}

Guidelines:
- Give a clear, direct answer in 2-4 sentences maximum.
- If the concept needs steps, use a short numbered list.
- Use simple language appropriate for school students.
- If the student seems confused, reassure them and simplify.
- End with a brief encouraging note if appropriate.
- Do NOT repeat the question. Do NOT use generic phrases like "Great question!".
- Answer ONLY from the context below. If context is insufficient, use your knowledge and say so briefly."""

    prompt = f"""{system_prompt}

Context from syllabus:
{context}

Student's question: {question}

Teacher's answer:"""

    # Try Ollama first (best quality)
    ollama_resp = call_ollama(prompt, max_tokens=350)
    if ollama_resp:
        return _clean_answer(ollama_resp), source_labels

    # Fallback: extractive answer from top chunk
    if results:
        best_chunk = results[0][0].strip()
        return _clean_answer(best_chunk[:700]), source_labels

    # Final fallback: local HF model
    if llm and llm_task:
        try:
            if llm_task == "text2text-generation":
                res = llm(prompt, max_new_tokens=150, do_sample=False)
                generated = res[0].get("generated_text", "")
            else:
                res = llm(prompt, max_new_tokens=120, temperature=0.3, do_sample=True, repetition_penalty=1.3)
                generated = res[0].get("generated_text", "")
            if "answer:" in generated.lower():
                generated = generated.lower().split("answer:")[-1].strip()
            return _clean_answer(generated), source_labels
        except Exception:
            pass

    return (
        "I'm sorry, I couldn't find a clear answer right now. Please check your textbook or ask your teacher. 📚",
        source_labels,
    )


# ---------------------------------------------------------------------------
# Quiz helpers
# ---------------------------------------------------------------------------

def _parse_mcqs_from_text(text: str, max_questions: int = 10) -> list[dict]:
    """Parse MCQ block into list of structured dicts."""
    import re
    questions = []
    block = (text or "").strip()
    parts = re.split(r"\n\s*(?:Question\s*\d+|Q\s*\d+)[.:)\s]+", block, flags=re.IGNORECASE)
    for part in parts:
        if len(questions) >= max_questions:
            break
        part = part.strip()
        if not part or len(part) < 20:
            continue
        opts = {"A": "", "B": "", "C": "", "D": ""}
        correct = "A"
        explanation = ""
        lines = [l.strip() for l in part.replace("\r", "\n").split("\n") if l.strip()]
        q_text = ""
        for line in lines:
            m = re.match(r"^([A-D])[.)]\s*(.+)$", line, re.IGNORECASE)
            if m:
                opts[m.group(1).upper()] = m.group(2).strip()
            elif re.match(r"^correct\s*:\s*([A-D])", line, re.IGNORECASE):
                c = re.search(r"[A-D]", line, re.IGNORECASE)
                if c:
                    correct = c.group(0).upper()
            elif line.lower().startswith("explanation"):
                explanation = line.split(":", 1)[-1].strip() if ":" in line else line[10:].strip()
            elif not q_text and len(line) > 10:
                q_text = line
        if not q_text:
            q_text = part.split("\n")[0][:500]
        if not q_text.strip():
            continue
        questions.append({
            "question_text": q_text[:1000],
            "option_a": opts.get("A", "")[:500] or "Option A",
            "option_b": opts.get("B", "")[:500] or "Option B",
            "option_c": opts.get("C", "")[:500] or "Option C",
            "option_d": opts.get("D", "")[:500] or "Option D",
            "correct_option": correct if correct in "ABCD" else "A",
            "explanation": explanation[:500] or "Refer to textbook.",
        })
    return questions[:max_questions]


def generate_quiz(
    topic: str,
    subject: str = "General",
    grade: int = 10,
    num_questions: int = 10,
) -> list[dict]:
    """
    Generate MCQs using RAG context + Ollama/LLM.
    Returns list of MCQ dicts.
    """
    num_questions = max(1, min(30, num_questions))
    query = f"{subject} class {grade} {topic}"
    results = document_registry.retrieve_chunks(query, k=8)
    context = "\n\n".join(c for c, _ in results[:6])[:3000] if results else f"Topic: {topic}. Subject: {subject}. Grade: {grade}."

    prompt = f"""You are an expert {subject} teacher for Class {grade}.
Generate exactly {num_questions} multiple choice questions (MCQs) on the topic: "{topic}".

Use ONLY the syllabus context provided below.
Each question MUST follow this EXACT format (no deviations):

Question 1: [question text here]
A) [option A]
B) [option B]
C) [option C]
D) [option D]
Correct: [A or B or C or D]
Explanation: [one-line explanation]

Question 2: ...

Rules:
- Questions must be clear and appropriate for Class {grade} students.
- Each question must have exactly 4 options.
- Vary difficulty: easy, medium, hard.
- Do NOT repeat questions.
- Explanation must be exactly one line.

Context:
{context}

Generate {num_questions} questions now:"""

    # Ollama gives best quality quizzes
    ollama_raw = call_ollama(prompt, max_tokens=min(2000, num_questions * 120))
    if ollama_raw:
        out = _parse_mcqs_from_text(ollama_raw, num_questions)
        if len(out) >= max(1, num_questions // 2):
            return _pad_questions(out, num_questions, topic)

    # HF model fallback
    out = []
    if llm:
        try:
            if llm_task == "text2text-generation":
                res = llm(prompt, max_new_tokens=min(1024, num_questions * 100), do_sample=False)
            else:
                res = llm(prompt, max_new_tokens=800, temperature=0.3, do_sample=True, repetition_penalty=1.2)
            raw = (res[0].get("generated_text") or "") if res else ""
            if "Question" in raw or "Q1" in raw:
                out = _parse_mcqs_from_text(raw, num_questions)
        except Exception:
            pass

    return _pad_questions(out, num_questions, topic)


def _pad_questions(out: list[dict], target: int, topic: str) -> list[dict]:
    """Pad with placeholder questions if generation was incomplete."""
    while len(out) < target:
        i = len(out) + 1
        out.append({
            "question_text": f"Question {i}: About {topic} (could not generate — check Ollama is running).",
            "option_a": "Option A",
            "option_b": "Option B",
            "option_c": "Option C",
            "option_d": "Option D",
            "correct_option": "A",
            "explanation": "Install Ollama (ollama.com) and run 'ollama pull mistral' for full quiz generation.",
        })
    return out[:target]


# ---------------------------------------------------------------------------
# FastAPI Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["chatbot"])


class Question(BaseModel):
    question: str
    topic: Optional[str] = None
    subject: Optional[str] = None
    chapter: Optional[str] = None


class GenerateQuizBody(BaseModel):
    topic_name: str
    subject: str = ""
    grade: int = 10
    num_questions: int = 10  # ← new: configurable (1-30)


@router.post("/ask")
def ask(q: Question):
    """Ask the AI teacher a question. Returns answer + source documents used."""
    question = (q.question or "").strip()
    if not question:
        return {"question": "", "answer": "Please ask a question.", "sources": []}
    try:
        answer, sources = generate_answer(question, q.topic, q.subject, q.chapter)
        return {
            "question": question,
            "answer": answer,
            "sources": sources,
            "doc_count": document_registry.doc_count,
            "ollama_active": ollama_available(),
        }
    except Exception as e:
        return {
            "question": question,
            "answer": f"Sorry, I couldn't process that. Please try again. ({str(e)[:80]})",
            "sources": [],
        }


@router.post("/quiz")
def quiz_endpoint(body: GenerateQuizBody):
    """
    Generate MCQs for a topic.
    
    Body: { topic_name, subject, grade, num_questions (1-30) }
    Returns: { questions: [...], topic, subject, grade, num_questions }
    """
    topic = (body.topic_name or "").strip() or "General"
    subject = (body.subject or "").strip() or "General"
    grade = body.grade or 10
    num_questions = max(1, min(30, body.num_questions or 10))
    try:
        questions = generate_quiz(topic, subject, grade, num_questions)
        return {
            "questions": questions,
            "topic": topic,
            "subject": subject,
            "grade": grade,
            "num_questions": len(questions),
            "ollama_active": ollama_available(),
        }
    except Exception as e:
        return {
            "questions": [],
            "error": f"Quiz generation failed: {str(e)[:200]}",
            "topic": topic,
        }


@router.get("/ai-status")
def ai_status():
    """Returns status of the AI system: docs loaded, Ollama availability."""
    from ingest import _load_manifest
    docs = _load_manifest()
    return {
        "ok": True,
        "doc_count": document_registry.doc_count,
        "documents": docs,
        "ollama_available": ollama_available(),
        "ollama_model": _ollama_model,
        "fallback_llm": _model_name if llm else None,
    }
