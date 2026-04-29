import os
import requests
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter
from typing import Optional
from pydantic import BaseModel


_here = Path(__file__).resolve().parent

# Optional RAG: load FAISS + chunks only if files exist (so server starts without them)
index = None
chunks = []
try:
    import faiss
    import numpy as np
    import pickle
    _faiss_path = _here / "syllabus_vectors.faiss"
    _chunks_path = _here / "chunks.pkl"
    if _faiss_path.exists() and _chunks_path.exists():
        print("[chatbot] Loading FAISS index...")
        index = faiss.read_index(str(_faiss_path))
        print("[chatbot] Loading syllabus chunks...")
        with open(_chunks_path, "rb") as f:
            chunks = pickle.load(f)
        print("[chatbot] RAG ready.")
    else:
        print("[chatbot] RAG skipped: missing syllabus_vectors.faiss or chunks.pkl (add them for context-aware answers).")
except Exception as e:
    print(f"[chatbot] RAG load failed: {str(e)[:120]}. Running without RAG.")

from shared_embeddings import embedding_model
from transformers import pipeline

print("[chatbot] Loading LLM...")
# Keep defaults aligned with broadly supported pipeline tasks across environments.
_model_name = (os.environ.get("CHATBOT_MODEL") or "distilgpt2").strip()
_preferred_task = (os.environ.get("CHATBOT_TASK") or "text-generation").strip()
llm = None
llm_task = None
try:
    llm_task = _preferred_task
    llm = pipeline(llm_task, model=_model_name)
except Exception as e:
    print(f"[chatbot] primary model load failed: {str(e)[:160]}")
    # Fallback to a tiny causal LM (fast + universally supported).
    try:
        llm_task = "text-generation"
        fallback_model = (os.environ.get("CHATBOT_FALLBACK_MODEL") or "distilgpt2").strip()
        llm = pipeline(llm_task, model=fallback_model)
    except Exception:
        llm_task = None
        llm = None

print(f"[chatbot] LLM ready: task={llm_task} model={_model_name if llm_task=='text2text-generation' else (os.environ.get('CHATBOT_FALLBACK_MODEL') or 'distilgpt2')}")


def call_ollama(prompt: str, model: str = "llama3") -> Optional[str]:
    """Helper to call local Ollama API if running."""
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_predict": 150
                }
            },
            timeout=45
        )
        if response.status_code == 200:
            return response.json().get("response")
    except Exception:
        pass
    return None


class Question(BaseModel):
    question: str
    topic: Optional[str] = None
    subject: Optional[str] = None
    chapter: Optional[str] = None



def retrieve_chunks(question: str, k: int = 5):
    """Retrieve top-k relevant chunks for better context. Returns [] if RAG not loaded."""
    if index is None or not chunks:
        return []
    import numpy as np
    question_embedding = embedding_model.encode([question], show_progress_bar=False)
    D, I = index.search(np.array(question_embedding).astype("float32"), min(k, len(chunks)))
    return [chunks[i] for i in I[0] if 0 <= i < len(chunks)]


def _dedupe_answer(text: str) -> str:
    if not text or not text.strip():
        return text
    text = text.replace("\x0c", " ").replace("\uFFFD", " ").strip()
    if "Answer:" in text:
        text = text.split("Answer:")[-1].strip()
    seen = set()
    out = []
    for part in text.replace("\n\n", "\n").split("\n"):
        part = part.strip()
        if not part or part.upper() in ("TE", "T E", ""):
            continue
        if part.isdigit():
            continue
        key = part[:80].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(part)

    result = "\n\n".join(out).strip()
    sentences = [s.strip() for s in result.split(". ") if s.strip()]
    if len(sentences) >= 2 and sentences[0] == sentences[1]:
        result = sentences[0] + "." if not sentences[0].endswith(".") else sentences[0]
    if len(result) > 200:
        first_chunk = result[:100].lower()
        idx = result.lower().find(first_chunk, 50)
        if idx > 80:
            result = result[:idx].strip()
    return result or text[:500].strip()


@lru_cache(maxsize=256)
def generate_answer(question: str, topic: Optional[str] = None, subject: Optional[str] = None, chapter: Optional[str] = None) -> str:
    if llm is None or llm_task is None:
        return "Chatbot model is not available on the server. Please restart the AI server after installing model dependencies."
    
    # Enrich retrieval with topic/subject/chapter if question is short
    retrieval_query = question
    if (topic or chapter) and len(question) < 40:
        retrieval_query = f"{subject or ''} {chapter or ''} {topic or ''}: {question}"
        
    retrieved = retrieve_chunks(retrieval_query)
    if not retrieved and topic:
        # fallback to general topic search if specific question failed
        retrieved = retrieve_chunks(topic)
    
    context = "\n\n".join(retrieved[:5])[:2000] if retrieved else ""
    
    # If no context found, we allow the LLM to use its internal knowledge but with a note.
    # This makes the AI feel "smarter" and more helpful.
    context_note = ""
    if not context:
        context_note = "(Note: Answering from general knowledge as this specific detail isn't in the uploaded syllabus chunks.)"
        context = f"Subject: {subject}. Chapter: {chapter}. Topic: {topic}."

    prompt = f"""You are an expert Class 10 {subject or 'Subject'} teacher.
Context: Chapter "{chapter or 'General'}", Topic "{topic or 'General'}".

Answer the student's question in a smart, professional, and CONCISE way (max 2-3 sentences).
Do not use generic greetings or long introductions. Get straight to the point.

Question: {question}
Answer:"""

    # Try Ollama (Llama 3) first for high quality
    ollama_response = call_ollama(prompt)
    if ollama_response:
        return _dedupe_answer(ollama_response)






    if llm_task == "text2text-generation":
        response = llm(
            prompt,
            max_new_tokens=120,
            do_sample=False,
        )
        generated = response[0].get("generated_text", "")
        return _dedupe_answer(generated)

    # If we are on a causal LM fallback, prefer an extractive answer to avoid hallucinations
    # and keep response time low.
    extract = retrieved[0].strip() if retrieved else context.strip()
    if extract:
        return _dedupe_answer(extract[:900])

    response = llm(
        prompt,
        max_new_tokens=100,
        temperature=0.2,
        do_sample=True,
        repetition_penalty=1.3,
    )
    generated = response[0].get("generated_text", "")
    if "Answer:" in generated:
        generated = generated.split("Answer:")[-1]
    return _dedupe_answer(generated)


router = APIRouter(tags=["chatbot"])


@router.post("/ask")
def ask(q: Question):
    question = (q.question or "").strip()
    if not question:
        return {"question": "", "answer": "Please ask a question."}
    try:
        answer = generate_answer(question, q.topic, q.subject, q.chapter)
        return {"question": question, "answer": answer}
    except Exception as e:
        return {"question": question, "answer": f"Sorry, I couldn't process that. Please try again. ({str(e)[:80]})"}



class GenerateQuizBody(BaseModel):
    topic_name: str
    subject: str = ""
    grade: int = 10
    count: int = 10  # Dynamic number of questions


def _parse_mcqs_from_text(text: str, max_questions: int = 10):
    """Parse block of MCQ text into list of { question_text, option_a, option_b, option_c, option_d, correct_option, explanation }."""
    import re
    questions = []
    block = (text or "").strip()
    # Split by "Question N" or "QN" or numbered lines
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
        questions.append({
            "question_text": q_text[:1000],
            "option_a": opts.get("A", "")[:500] or "Option A",
            "option_b": opts.get("B", "")[:500] or "Option B",
            "option_c": opts.get("C", "")[:500] or "Option C",
            "option_d": opts.get("D", "")[:500] or "Option D",
            "correct_option": correct if correct in "ABCD" else "A",
            "explanation": explanation[:500] or "See textbook.",
        })
    return questions[:max_questions]


@router.post("/generate_quiz")
def generate_quiz(body: GenerateQuizBody):
    """Generate N MCQs for a topic using RAG context. Returns list of { question_text, option_a..d, correct_option, explanation }."""
    topic = (body.topic_name or "").strip() or "General"
    subject = (body.subject or "").strip() or "Subject"
    grade = body.grade or 10
    count = max(1, min(body.count, 20)) # Safety limit 1-20
    query = f"{subject} class {grade} {topic}"
    retrieved = retrieve_chunks(query)
    context = "\n\n".join(retrieved[:5])[:2500] if retrieved else f"Topic: {topic}. Subject: {subject}. Class: {grade}."
    prompt = f"""Generate exactly {count} multiple choice questions (MCQ) for class {grade} topic: {topic} ({subject}).
Use ONLY the context below. Each question must have 4 options labeled A, B, C, D and one correct answer.
Format each question exactly like this:
Question 1: [question text]
A) [option A]
B) [option B]
C) [option C]
D) [option D]
Correct: [A or B or C or D]
Explanation: [one line explanation]

Then Question 2: ... and so on for 10 questions.

Context:
{context}

Generate 10 questions:"""

    # Try Ollama first for high quality quizzes
    ollama_raw = call_ollama(prompt)
    if ollama_raw:
        out = _parse_mcqs_from_text(ollama_raw, count)
        if len(out) >= (count // 2): 
            return {"questions": out[:count]}

    out = []
    try:
        if llm_task == "text2text-generation" and llm:
            res = llm(prompt, max_new_tokens=1024, do_sample=False)
            raw = (res[0].get("generated_text") or "") if res else ""
            if "Question" in raw or "Q1" in raw:
                out = _parse_mcqs_from_text(raw, count)
        if not out and llm:
            res = llm(prompt, max_new_tokens=800, temperature=0.3, do_sample=True, repetition_penalty=1.2)
            raw = (res[0].get("generated_text") or "") if res else ""
            out = _parse_mcqs_from_text(raw, count)
    except Exception:
        pass
    if len(out) < count:
        for i in range(len(out), count):
            out.append({
                "question_text": f"Question {i+1} on {topic} (generation incomplete).",
                "option_a": "Option A", "option_b": "Option B", "option_c": "Option C", "option_d": "Option D",
                "correct_option": "A", "explanation": "Refer to textbook.",
            })
    return {"questions": out[:count]}
