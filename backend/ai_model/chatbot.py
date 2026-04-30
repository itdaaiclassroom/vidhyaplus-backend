"""
chatbot.py — VidhyaPlus AI Teacher Assistant
=============================================

LLM Priority Order (per query):
  1. Ollama (mistral / configured model) — best quality
  2. RAG extractive chunk — direct best-match from indexed docs
  3. Local HF distilgpt2 — last resort offline fallback

Routes exposed via router:
  POST /ask            — Student Q&A (RAG + Ollama)
  POST /generate_quiz  — MCQ quiz generation (RAG + Ollama)
"""

import os
import re
import pickle
import threading
from pathlib import Path
from typing import Optional, List

import requests
from fastapi import APIRouter
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["chatbot"])

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_HERE = Path(__file__).resolve().parent
INDEXES_DIR = _HERE / "indexes"
INDEXES_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Config from .env
# ---------------------------------------------------------------------------

_ollama_model  = (os.environ.get("OLLAMA_MODEL")          or "mistral").strip()
_hf_model      = (os.environ.get("CHATBOT_MODEL")         or "distilgpt2").strip()
_hf_task       = (os.environ.get("CHATBOT_TASK")          or "text-generation").strip()
_hf_fallback   = (os.environ.get("CHATBOT_FALLBACK_MODEL") or "distilgpt2").strip()

# ---------------------------------------------------------------------------
# DocumentRegistry — multi-doc FAISS search
# ---------------------------------------------------------------------------

class DocumentRegistry:
    """Thread-safe registry that loads and searches ALL per-doc FAISS indexes."""

    def __init__(self):
        self._lock = threading.RLock()
        self._entries: List[dict] = []
        self.reload()

    def reload(self):
        """(Re)load all *.faiss + *.pkl pairs from indexes/."""
        try:
            import faiss
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
                new_entries.append({
                    "id": doc_id,
                    "index": idx,
                    "chunks": chunks,
                    "label": doc_id,
                })
            except Exception as e:
                print(f"[chatbot] Failed to load {doc_id}: {e}")

        # Enrich labels from manifest
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

        total = sum(len(e["chunks"]) for e in new_entries)
        print(f"[chatbot] DocumentRegistry: {len(new_entries)} docs, {total} total chunks.")

    def retrieve_chunks(self, query: str, k: int = 6) -> List[tuple]:
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
        for entry in entries:
            idx    = entry["index"]
            chunks = entry["chunks"]
            label  = entry["label"]
            if idx.ntotal == 0 or not chunks:
                continue
            actual_k = min(k, idx.ntotal)
            D, I = idx.search(q_emb, actual_k)
            for dist, ci in zip(D[0], I[0]):
                if 0 <= ci < len(chunks):
                    results.append((float(dist), chunks[ci], label))

        results.sort(key=lambda x: x[0])  # ascending (lower L2 = more relevant)

        # Deduplicate by chunk prefix
        seen, deduped = set(), []
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


# Singleton — loaded once at startup, hot-reloaded after ingest
document_registry = DocumentRegistry()


# ---------------------------------------------------------------------------
# LLM setup
# PRIMARY  : Ollama (mistral or OLLAMA_MODEL)
# FALLBACK : local HF distilgpt2 (used ONLY when Ollama is offline)
# ---------------------------------------------------------------------------

llm = None
llm_task = None

# ── Check Ollama at startup ────────────────────────────────────────────────
try:
    _ping = requests.get("http://localhost:11434/api/tags", timeout=3)
    if _ping.status_code == 200:
        _installed = [m.get("name", "") for m in _ping.json().get("models", [])]
        print(f"[chatbot] ✅ PRIMARY LLM  → Ollama RUNNING | model={_ollama_model} | installed={_installed or ['(none)']}")
    else:
        print(f"[chatbot] ⚠️  PRIMARY LLM  → Ollama status={_ping.status_code}")
except Exception:
    print(f"[chatbot] ❌ PRIMARY LLM  → Ollama NOT reachable — will use fallback")

# ── Load HF distilgpt2 as standby fallback ────────────────────────────────
print(f"[chatbot] ⏳ FALLBACK LLM → Loading {_hf_model} (standby only)...")
try:
    from transformers import pipeline
    llm_task = _hf_task
    llm = pipeline(llm_task, model=_hf_model)
    print(f"[chatbot] ✅ FALLBACK LLM → {_hf_model} ready")
except Exception as e:
    print(f"[chatbot] ⚠️  FALLBACK LLM → {_hf_model} failed: {str(e)[:100]}")
    try:
        from transformers import pipeline
        llm_task = "text-generation"
        llm = pipeline(llm_task, model=_hf_fallback)
        print(f"[chatbot] ✅ FALLBACK LLM → {_hf_fallback} ready (secondary)")
    except Exception:
        llm = None
        llm_task = None
        print("[chatbot] ❌ FALLBACK LLM → No local model. Ollama is required.")

print(f"[chatbot] 📋 Priority: 1=Ollama({_ollama_model}) → 2=RAG chunk → 3={_hf_model}")


# ---------------------------------------------------------------------------
# Ollama helpers
# ---------------------------------------------------------------------------

def call_ollama(prompt: str, model: Optional[str] = None, max_tokens: int = 400) -> Optional[str]:
    """Call Ollama. Returns None if offline or error."""
    model = model or _ollama_model
    try:
        resp = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"num_predict": max_tokens, "temperature": 0.7, "top_p": 0.9},
            },
            timeout=60,
        )
        if resp.status_code == 200:
            result = resp.json().get("response", "")
            return result.strip() if result else None
    except Exception:
        pass
    return None


def ollama_available() -> bool:
    """Quick reachability check."""
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def ollama_status() -> dict:
    """Detailed Ollama status for /ollama-status endpoint."""
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=3)
        if r.status_code == 200:
            models = [m.get("name", "") for m in r.json().get("models", [])]
            installed = any(_ollama_model.split(":")[0] in m for m in models)
            return {
                "running": True,
                "configured_model": _ollama_model,
                "model_installed": installed,
                "installed_models": models,
                "message": (
                    f"Ollama running. Model '{_ollama_model}' installed OK."
                    if installed
                    else f"Ollama running but '{_ollama_model}' not found. Run: ollama pull {_ollama_model}"
                ),
            }
        return {
            "running": False, "configured_model": _ollama_model,
            "model_installed": False, "installed_models": [],
            "message": f"Ollama returned HTTP {r.status_code}",
        }
    except Exception as e:
        return {
            "running": False, "configured_model": _ollama_model,
            "model_installed": False, "installed_models": [],
            "message": "Ollama not reachable. Start with: ollama serve",
        }


# ---------------------------------------------------------------------------
# Text cleaning
# ---------------------------------------------------------------------------

def _clean_answer(text: str) -> str:
    if not text or not text.strip():
        return text
    text = text.replace("\x0c", " ").replace("\uFFFD", " ").strip()
    if "Answer:" in text:
        text = text.split("Answer:")[-1].strip()
    # Deduplicate lines
    seen, out = set(), []
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
) -> tuple:
    """
    Generate an answer. Returns (answer_text, source_labels_list).
    Priority: Ollama → RAG extractive → HF distilgpt2 → static fallback
    """
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

    system_prompt = f"""You are an excellent, caring teacher helping a school student.
Subject: {subject or 'General'}  |  Chapter: {chapter or 'General'}  |  Topic: {topic or 'General'}

Rules:
- Answer in 2-4 clear sentences. Use a numbered list only if steps are needed.
- Use simple language suitable for school students.
- Do NOT repeat the question. Do NOT say "Great question!".
- Answer ONLY from the context. If insufficient, use your knowledge and say so briefly."""

    prompt = f"""{system_prompt}

Context from syllabus:
{context}

Student's question: {question}

Teacher's answer:"""

    # ── 1. Try Ollama (best quality) ──────────────────────────────────────
    ollama_resp = call_ollama(prompt, max_tokens=350)
    if ollama_resp:
        return _clean_answer(ollama_resp), source_labels

    # ── 2. RAG extractive (offline but grounded) ───────────────────────────
    if results:
        best_chunk = results[0][0].strip()
        return _clean_answer(best_chunk[:700]), source_labels

    # ── 3. Local HF model (last resort) ───────────────────────────────────
    if llm and llm_task:
        try:
            if llm_task == "text2text-generation":
                res = llm(prompt, max_new_tokens=150, do_sample=False)
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
# API Route: POST /ask
# ---------------------------------------------------------------------------

class AskBody(BaseModel):
    question: str
    topic: Optional[str] = None
    subject: Optional[str] = None
    chapter: Optional[str] = None


@router.post("/ask", summary="Ask AI Teacher a question")
def ask(body: AskBody):
    """
    Answer a student's question using RAG + Ollama.

    **LLM Priority:** Ollama → RAG extractive → distilgpt2

    Returns:
    - `answer`: The AI-generated teacher response
    - `source_docs`: Which indexed documents were used
    """
    if not body.question or not body.question.strip():
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="'question' field is required and cannot be empty.")

    answer, source_docs = generate_answer(
        question=body.question.strip(),
        topic=body.topic,
        subject=body.subject,
        chapter=body.chapter,
    )
    return {
        "answer": answer,
        "source_docs": source_docs,
        "model_used": "ollama" if ollama_available() else "rag_extractive_or_distilgpt2",
    }


# ---------------------------------------------------------------------------
# Quiz MCQ helpers
# ---------------------------------------------------------------------------

def _parse_mcqs(text: str, max_q: int = 10) -> List[dict]:
    """Parse Ollama MCQ output into structured list."""
    questions = []
    block = (text or "").strip()
    parts = re.split(r"\n\s*(?:Question\s*\d+|Q\s*\d+)[.:)\s]+", block, flags=re.IGNORECASE)

    for part in parts:
        if len(questions) >= max_q:
            break
        part = part.strip()
        if not part or len(part) < 20:
            continue

        opts = {"A": "", "B": "", "C": "", "D": ""}
        correct = "A"
        explanation = ""
        q_text = ""
        lines = [l.strip() for l in part.replace("\r", "\n").split("\n") if l.strip()]

        for line in lines:
            m = re.match(r"^([A-D])[.)]\s*(.+)$", line, re.IGNORECASE)
            if m:
                opts[m.group(1).upper()] = m.group(2).strip()
            elif re.match(r"^correct\s*:\s*([A-D])", line, re.IGNORECASE):
                c = re.search(r"[A-D]", line, re.IGNORECASE)
                if c:
                    correct = c.group(0).upper()
            elif line.lower().startswith("explanation"):
                explanation = line.split(":", 1)[-1].strip() if ":" in line else line[11:].strip()
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

    return questions[:max_q]


def _placeholder_questions(topic: str, count: int) -> List[dict]:
    """Return placeholder MCQs when all LLMs fail."""
    return [
        {
            "question_text": f"Question {i + 1} about {topic} (AI generation unavailable).",
            "option_a": "Option A", "option_b": "Option B",
            "option_c": "Option C", "option_d": "Option D",
            "correct_option": "A",
            "explanation": "Please restart the AI server and try again.",
        }
        for i in range(count)
    ]


# ---------------------------------------------------------------------------
# API Route: POST /generate_quiz
# ---------------------------------------------------------------------------

class GenerateQuizBody(BaseModel):
    topic_name: str
    subject: str = ""
    grade: int = 10
    count: int = 10  # number of questions (1–20)


@router.post("/generate_quiz", summary="Generate MCQ quiz for a topic")
def generate_quiz(body: GenerateQuizBody):
    """
    Generate N multiple-choice questions using RAG context + Ollama.

    **LLM Priority:** Ollama → HF distilgpt2 → placeholder fallback

    Returns:
    - `questions`: list of MCQ objects with question_text, option_a/b/c/d, correct_option, explanation
    """
    topic   = (body.topic_name or "").strip() or "General"
    subject = (body.subject    or "").strip() or "General"
    grade   = body.grade or 10
    count   = max(1, min(body.count, 20))

    query     = f"{subject} class {grade} {topic}"
    retrieved = [chunk for chunk, _ in document_registry.retrieve_chunks(query, k=5)]
    context   = "\n\n".join(retrieved[:5])[:2500] if retrieved else f"Topic: {topic}. Subject: {subject}. Class {grade}."

    prompt = f"""Generate exactly {count} multiple-choice questions (MCQ) for Class {grade} topic: {topic} ({subject}).
Use the context below. Each question MUST have exactly 4 options (A, B, C, D) and one correct answer.

Format STRICTLY like this for each question:
Question N: [question text]
A) [option]
B) [option]
C) [option]
D) [option]
Correct: [A or B or C or D]
Explanation: [one sentence]

Rules:
- Vary difficulty: mix easy, medium, hard.
- Do NOT repeat questions.
- Do NOT include the context text verbatim as the question.

Context:
{context}

Generate {count} questions now:"""

    # ── 1. Ollama (best quality) ───────────────────────────────────────────
    ollama_raw = call_ollama(prompt, max_tokens=min(2000, count * 130))
    if ollama_raw:
        out = _parse_mcqs(ollama_raw, count)
        if len(out) >= max(1, count // 2):
            # Pad if short
            out += _placeholder_questions(topic, count - len(out))
            return {"questions": out[:count], "model_used": "ollama"}

    # ── 2. HF distilgpt2 fallback ─────────────────────────────────────────
    out = []
    if llm:
        try:
            if llm_task == "text2text-generation":
                res = llm(prompt, max_new_tokens=1024, do_sample=False)
            else:
                res = llm(prompt, max_new_tokens=800, temperature=0.3, do_sample=True, repetition_penalty=1.2)
            raw = (res[0].get("generated_text") or "") if res else ""
            out = _parse_mcqs(raw, count)
        except Exception:
            pass

    if not out:
        out = _placeholder_questions(topic, count)
    else:
        out += _placeholder_questions(topic, count - len(out))

    return {"questions": out[:count], "model_used": "distilgpt2_or_placeholder"}
