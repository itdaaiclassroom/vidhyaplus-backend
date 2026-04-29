"""
segmentation.py — Chapter & Topic extraction for VidhyaPlus AI

Endpoints:
  POST /segment_chapter   — Single chapter PDF → list of topics
  POST /extract_textbook  — Full textbook PDF → all chapters + their topics
"""
import os
import re
import io
import httpx
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pypdf import PdfReader
from build_index import build as rebuild_rag_index

router = APIRouter(tags=["segmentation"])


# ─────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────

class SegmentRequest(BaseModel):
    """Request body for /segment_chapter (single chapter PDF)."""
    pdf_path: str
    subject: str = "Subject"
    grade: int = 10


class TextbookRequest(BaseModel):
    """Request body for /extract_textbook (full multi-chapter textbook PDF)."""
    pdf_path: str
    subject: str = "Subject"
    grade: int = 10
    max_chapters: int = 30          # Safety cap — stop after N chapters
    max_pages_per_chapter: int = 40 # Only send first N pages of each chapter to AI


class TopicSegment(BaseModel):
    name: str
    summary: str
    order_num: int


class ChapterResult(BaseModel):
    chapter_num: int
    chapter_name: str
    start_page: int
    end_page: int
    topics: List[TopicSegment]


# ─────────────────────────────────────────────
# Internal Helpers
# ─────────────────────────────────────────────

def _get_pdf_reader(path_or_url: str) -> PdfReader:
    """
    Returns a PdfReader object from either a local file path or a URL (R2/S3).
    """
    if path_or_url.startswith(("http://", "https://")):
        try:
            # Using httpx to download the PDF into memory
            response = httpx.get(path_or_url, follow_redirects=True, timeout=30.0)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Cloudflare R2/S3 Download Error: HTTP {response.status_code} for {path_or_url}"
                )
            return PdfReader(io.BytesIO(response.content))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch PDF from URL: {str(e)}")
    else:
        # Local file check
        if not os.path.exists(path_or_url):
            raise HTTPException(status_code=404, detail=f"Local PDF not found at: {path_or_url}")
        return PdfReader(path_or_url)


def _call_ollama_safe(prompt: str) -> Optional[str]:
    """Call Ollama safely — returns None if not running, never crashes."""
    try:
        from chatbot import call_ollama
        return call_ollama(prompt)
    except Exception:
        return None


def _parse_topics(raw: str, subject: str, grade: int) -> List[TopicSegment]:
    """
    Parse AI output into TopicSegment list.
    Handles two formats:
      Format A (preferred): Topic: [Title] | Summary: [Text]
      Format B (fallback):  numbered lines like "1. Real Numbers"
    """
    topics: List[TopicSegment] = []
    order = 1

    # Strip the prompt echo if Ollama repeated it
    for marker in ["Topics:", "topics:"]:
        if marker in raw:
            raw = raw.split(marker)[-1]

    for line in raw.split("\n"):
        line = line.strip()
        if not line or len(line) < 4:
            continue

        # Format A: Topic: X | Summary: Y
        if "Topic:" in line and "Summary:" in line:
            try:
                parts = line.split("|")
                title = parts[0].replace("Topic:", "").strip(" -•*")
                summary = parts[1].replace("Summary:", "").strip() if len(parts) > 1 else f"Study of {title}."
                if title:
                    topics.append(TopicSegment(name=title, summary=summary, order_num=order))
                    order += 1
            except Exception:
                continue

        # Format B: "1. Real Numbers" or "- Real Numbers" or "* Real Numbers"
        elif re.match(r"^(\d+[.)]\s+|[-•*]\s+).{4,60}$", line):
            title = re.sub(r"^(\d+[.)]\s+|[-•*]\s+)", "", line).strip()
            if title and not title.lower().startswith(("note", "example", "exercise", "fig")):
                topics.append(TopicSegment(
                    name=title,
                    summary=f"A key topic in Grade {grade} {subject}.",
                    order_num=order,
                ))
                order += 1

    return topics


def _rule_based_topics(text: str, subject: str, grade: int) -> List[TopicSegment]:
    """
    Pure rule-based fallback when AI is unavailable.
    Detects short Title-Case lines as likely topic headings.
    """
    topics: List[TopicSegment] = []
    order = 1
    seen: set = set()

    for line in text.split("\n"):
        line = line.strip()
        # Heuristic: 5–70 chars, Title Case, no punctuation at end
        if (
            5 < len(line) < 70
            and not line.endswith((".", ",", ":", "?", "!"))
            and re.search(r"[A-Za-z]", line)  # contains at least one letter
            and (line[0].isupper() or line[0].isdigit())
            and line.lower() not in seen
        ):
            seen.add(line.lower())
            topics.append(TopicSegment(
                name=line,
                summary=f"Detailed study of {line}.",
                order_num=order,
            ))
            order += 1
            if order > 10:
                break

    if not topics:
        topics = [
            TopicSegment(name="Introduction", summary="Overview of chapter concepts.", order_num=1),
            TopicSegment(name="Core Concepts", summary="Deep dive into primary subjects.", order_num=2),
            TopicSegment(name="Summary & Review", summary="Recap of key learnings.", order_num=3),
        ]
    return topics


def _extract_topics_for_chapter(
    text: str,
    chapter_name: str,
    subject: str,
    grade: int,
) -> List[TopicSegment]:
    """
    Given the raw text of one chapter, ask Ollama to extract topics.
    Falls back to rule-based extraction if Ollama is unavailable.
    """
    # Limit text sent to AI to avoid token overflow (Ollama handles ~2000 chars well)
    text_slice = text[:2500].strip()

    if not text_slice:
        return _rule_based_topics(text, subject, grade)

    prompt = f"""You are an expert curriculum designer for Grade {grade} {subject}.

Read the following chapter text from the chapter "{chapter_name}".
List all logical sub-topics found in this chapter.

Output ONLY in this exact format, one topic per line:
Topic: [Topic Title] | Summary: [One sentence description]

Chapter Text:
{text_slice}

Topics:"""

    raw = _call_ollama_safe(prompt)

    if raw:
        topics = _parse_topics(raw, subject, grade)
        if topics:
            return topics

    # Fallback: try tiny local LLM
    try:
        from chatbot import llm, llm_task
        if llm and llm_task == "text-generation":
            res = llm(prompt, max_new_tokens=300, temperature=0.3, do_sample=True)
            raw2 = res[0].get("generated_text", "") if res else ""
            topics2 = _parse_topics(raw2, subject, grade)
            if topics2:
                return topics2
    except Exception:
        pass

    # Final fallback: pure rule-based
    return _rule_based_topics(text, subject, grade)


# ─────────────────────────────────────────────
# Chapter Detection Helpers
# ─────────────────────────────────────────────

def _detect_chapters_from_toc(reader: PdfReader):
    """
    Try to read the PDF's built-in Table of Contents (outline).
    Returns list of dicts: {chapter_name, page_index} or [] if no TOC.
    """
    chapters = []
    try:
        outline = reader.outline  # pypdf attribute
        if not outline:
            return []

        def _walk(items, depth=0):
            for item in items:
                if isinstance(item, list):
                    _walk(item, depth + 1)
                else:
                    try:
                        title = (item.title or "").strip()
                        page_idx = reader.get_destination_page_number(item)
                        if title and page_idx is not None and depth <= 1:
                            chapters.append({
                                "chapter_name": title,
                                "page_index": int(page_idx),
                            })
                    except Exception:
                        continue

        _walk(outline)
    except Exception:
        pass
    return chapters


_CHAPTER_PATTERNS = re.compile(
    r"^\s*("
    r"chapter\s+\d+"             # "Chapter 1"
    r"|chapter\s+[ivxlcdm]+"     # "Chapter IV"
    r"|unit\s+\d+"               # "Unit 3"
    r"|\d+\.\s+[A-Z][A-Za-z\s]+" # "1. Real Numbers"
    r"|[A-Z][A-Z\s]{5,40}"       # "REAL NUMBERS" (all-caps heading)
    r")",
    re.IGNORECASE,
)


def _detect_chapters_by_scan(reader: PdfReader, max_chapters: int):
    """
    Scan every page for lines that look like chapter headings.
    Returns list of dicts: {chapter_name, page_index}.
    """
    chapters = []
    seen_names: set = set()

    for page_idx, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        for line in text.split("\n"):
            line = line.strip()
            if not line or len(line) > 80:
                continue
            if _CHAPTER_PATTERNS.match(line):
                clean = line.strip(" \t\r\n-•*")
                key = clean.lower()[:40]
                if key not in seen_names:
                    seen_names.add(key)
                    chapters.append({
                        "chapter_name": clean,
                        "page_index": page_idx,
                    })
                    if len(chapters) >= max_chapters:
                        return chapters
    return chapters


def _build_chapter_page_ranges(chapters: list, total_pages: int):
    """
    Given a list of {chapter_name, page_index}, compute end pages.
    """
    result = []
    for i, ch in enumerate(chapters):
        start = ch["page_index"]
        end = chapters[i + 1]["page_index"] - 1 if i + 1 < len(chapters) else total_pages - 1
        result.append({
            "chapter_name": ch["chapter_name"],
            "start_page": start,
            "end_page": end,
        })
    return result


def _extract_chapter_text(reader: PdfReader, start_page: int, end_page: int, max_pages: int) -> str:
    """Extract text from a range of pages (capped at max_pages to avoid memory issues)."""
    text = ""
    limit = min(end_page + 1, start_page + max_pages)
    for i in range(start_page, limit):
        if i < len(reader.pages):
            text += reader.pages[i].extract_text() or ""
    return text


# ─────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────

@router.post("/segment_chapter")
def segment_chapter(req: SegmentRequest):
    """
    Single chapter PDF → extract logical topics with AI.
    (Upgraded: no more 10-page limit, supports R2/S3 URLs)
    """
    try:
        reader = _get_pdf_reader(req.pdf_path)
        text = ""
        for page in reader.pages:  # Read ALL pages of the chapter
            text += page.extract_text() or ""

        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF. Make sure it is a text-based PDF (not a scanned image).")

        topics = _extract_topics_for_chapter(
            text=text,
            chapter_name="this chapter",
            subject=req.subject,
            grade=req.grade,
        )
        return {"topics": [t.model_dump() for t in topics]}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {str(e)}")


@router.post("/extract_textbook")
def extract_textbook(req: TextbookRequest):
    """
    Full textbook PDF → detect all chapters → extract topics for each chapter.
    Supports local files and Cloudflare R2 / S3 bucket URLs.
    """
    try:
        # ── Step 0: Auto-Index for RAG (Chatbot & Quizzes) ──
        print(f"[segmentation] Triggering auto-index for: {req.pdf_path}")
        rebuild_rag_index(req.pdf_path)

        reader = _get_pdf_reader(req.pdf_path)
        total_pages = len(reader.pages)

        # ── Step 1: Detect chapters ──
        raw_chapters = _detect_chapters_from_toc(reader)
        detection_method = "table_of_contents"

        if not raw_chapters:
            raw_chapters = _detect_chapters_by_scan(reader, req.max_chapters)
            detection_method = "page_scan"

        if not raw_chapters:
            # If absolutely nothing is detected, treat the whole book as one chapter
            raw_chapters = [{"chapter_name": "Full Textbook", "page_index": 0}]
            detection_method = "single_block_fallback"

        # ── Step 2: Build page ranges ──
        chapters_with_ranges = _build_chapter_page_ranges(raw_chapters, total_pages)

        # ── Step 3: Extract topics per chapter ──
        results: List[ChapterResult] = []

        for i, ch in enumerate(chapters_with_ranges):
            chapter_text = _extract_chapter_text(
                reader,
                ch["start_page"],
                ch["end_page"],
                req.max_pages_per_chapter,
            )

            topics = _extract_topics_for_chapter(
                text=chapter_text,
                chapter_name=ch["chapter_name"],
                subject=req.subject,
                grade=req.grade,
            )

            results.append(ChapterResult(
                chapter_num=i + 1,
                chapter_name=ch["chapter_name"],
                start_page=ch["start_page"] + 1,  # Convert to 1-indexed for display
                end_page=ch["end_page"] + 1,
                topics=topics,
            ))

        return {
            "total_pages": total_pages,
            "total_chapters": len(results),
            "detection_method": detection_method,
            "chapters": [r.model_dump() for r in results],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Textbook extraction failed: {str(e)}")


@router.post("/generate_ppt")
def generate_ppt(topic_name: str, subject: str = "Subject"):
    """
    Placeholder for an external PPT generation service.
    """
    dummy_url = f"https://example.com/generated_ppt/{topic_name.lower().replace(' ', '_')}.pptx"
    return {
        "ok": True,
        "topic_name": topic_name,
        "ppt_url": dummy_url,
        "message": "PPT generated via external service (simulated)",
    }
