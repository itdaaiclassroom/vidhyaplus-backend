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

from fastapi import APIRouter, HTTPException, Request, UploadFile, Form
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
            # Full browser spoofing + massive 5-minute timeout for slow Indian govt servers
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://www.google.com/"
            }
            response = httpx.get(path_or_url, headers=headers, follow_redirects=True, timeout=300.0, verify=False)
            if response.status_code != 200:
                print(f"[segmentation] URL fetch failed with HTTP {response.status_code} for {path_or_url}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Cloudflare R2/S3 Download Error: HTTP {response.status_code} for {path_or_url}"
                )
            return PdfReader(io.BytesIO(response.content))
        except HTTPException:
            raise
        except Exception as e:
            print(f"[segmentation] Exception fetching URL {path_or_url}: {str(e)}")
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


# ---------------------------------------------------------------------------
# Comprehensive noise filter for Indian school textbook PDFs
# Blocks: copyright, printing specs, publisher info, anthem, preamble,
#         figure/table labels, QR/app instructions, page headers
# ---------------------------------------------------------------------------
_TOPIC_NOISE = re.compile(
    r'(?i)('
    # Publishing / printing boilerplate
    r'published\s+by|first\s+published|republished|reprinted|'
    r'printed\s+on|g\s*\.\s*s\s*\.\s*m|maplitho|white\s+art\s+card|'
    r'title\s+page|copyright|all\s+rights\s+reserved|isbn|'
    r'hyderabad|andhra\s+pradesh|new\s+delhi|'
    # Publisher / authority names
    r'scert|telangana|government\s+of|state\s+council|ncert|cbse|'
    r'department\s+of|ministry\s+of|board\s+of|'
    # QR code / app installation steps
    r'qr\s*code|scan|install|click|download\s+and|'
    r'play\s+store|app\s+store|choose.*language|'
    r'student\s*/\s*teacher|'
    # National anthem / preamble / pledge
    r'jana\s+gana|adhinayaka|bharat\s+bhagya|'
    r'we,?\s+the\s+people\s+of\s+india|'
    r'sovereign|socialist|secular|democratic|republic|'
    r'well-being\s+and\s+prosperity|'
    # Figure / table / exercise labels
    r'^fig[-\s]*[\d(]|^table\s*\d|^fig\.|'
    r'boiling\s+the|iodine\s+test|'  # figure captions
    # Class / grade labels (not topics)
    r'^class\s+[xivlcdm\d]+\s*$|'
    r'^(biology|physics|chemistry|mathematics|science|social)\s*$|'
    # Page markers and numbers
    r'^\d+\s*$|^page\s*\d'
    r')'
)

# Lines that look like real academic topic headings in Indian textbooks
# Must start with "Chapter", a number+dot, or a capitalized word 4+ chars
_CHAPTER_HEADING = re.compile(
    r'^(chapter\s+\d+|unit\s+\d+|\d+\.\s+[A-Z])',
    re.IGNORECASE,
)


def _is_academic_heading(line: str) -> bool:
    """Return True only if the line looks like a real academic topic heading."""
    # Must have 2–8 words
    words = line.split()
    if not (2 <= len(words) <= 8):
        return False
    # Must not be all-caps (those are page headers)
    alpha_only = re.sub(r'[^a-zA-Z]', '', line)
    if alpha_only and alpha_only.isupper():
        return False
    # Block lines where more than 1 token is a pure number (table data rows)
    # e.g. "Wanaparthy 4000 1000 155" or "Small 110 - 180 25,000- 65,000"
    num_tokens = sum(1 for w in words if re.match(r'^\d[\d,.-]*$', w))
    if num_tokens >= 2:
        return False
    # Block lines with any standalone number (likely table data)
    if re.search(r'\b\d{3,}\b', line):
        return False
    # Must start with uppercase letter
    if not line[0].isupper():
        return False
    # Must not be a sentence (sentences end with . ! ? ; ,)
    if line.endswith(('.', '!', '?', ';', ',')):
        return False
    # At least 50% of words must be real alpha words (3+ chars)
    # This blocks "Table-1: Data at the beginning of the study" (has colon + numbers)
    real_words = [w for w in words if len(w) >= 3 and w.isalpha()]
    if len(real_words) < max(1, len(words) // 2):
        return False
    # At least one longer content word (4+ chars) for substance
    long_words = [w for w in words if len(w) >= 4 and w.isalpha()]
    if len(long_words) < 1:
        return False
    # Should NOT contain quotes or special unicode
    if any(c in line for c in ['"', '\u201c', '\u201d', '\u2014', '©', '®', '™']):
        return False
    # Block table-like lines (contain ":" followed by numbers, or dash-separated numbers)
    if re.search(r':\s*\d|\d\s*-\s*\d', line):
        return False
    return True


def _rule_based_topics(text: str, subject: str, grade: int) -> List[TopicSegment]:
    """
    Rule-based topic extraction — used when Ollama is offline.
    Much stricter than before: only returns lines that genuinely
    look like academic sub-topic headings.
    """
    topics: List[TopicSegment] = []
    order = 1
    seen: set = set()

    for line in text.split("\n"):
        line = line.strip()

        # Length: topics are typically 10–70 characters
        if not (10 < len(line) < 70):
            continue

        # Apply comprehensive noise filter first
        if _TOPIC_NOISE.search(line):
            continue

        # Apply academic heading heuristics
        if not _is_academic_heading(line):
            continue

        key = line.lower()[:50]
        if key in seen:
            continue
        seen.add(key)

        topics.append(TopicSegment(
            name=line,
            summary=f"Study of {line} — a key topic in Grade {grade} {subject}.",
            order_num=order,
        ))
        order += 1
        if order > 12:
            break

    if not topics:
        # Absolute fallback — generic structure
        topics = [
            TopicSegment(name="Introduction", summary="Overview of key concepts in this chapter.", order_num=1),
            TopicSegment(name="Core Concepts", summary="Primary definitions and explanations.", order_num=2),
            TopicSegment(name="Summary & Review", summary="Recap and key learnings.", order_num=3),
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

Read the following chapter text from "{chapter_name}".
List ONLY the real academic sub-topics taught in this chapter.

IMPORTANT - Ignore completely:
- QR code instructions, app installation steps
- Publisher names (SCERT, Government, Telangana)
- Page headers, page numbers, class/subject titles
- Copyright notices, how-to-use sections

Output ONLY real academic topics in this exact format, one per line:
Topic: [Topic Title] | Summary: [One sentence description of what students learn]

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

@router.post("/segment_chapter", summary="Single chapter PDF → list of topics")
async def segment_chapter(request: Request):
    """
    Extract topics from a single chapter PDF.

    Accepts TWO input formats:

    **Option A — JSON body (URL or local path):**
    ```json
    { "pdf_path": "https://...", "subject": "Biology", "grade": 10 }
    ```

    **Option B — File Upload (multipart/form-data):**
    ```
    file=<PDF binary>  subject=Biology  grade=10  chapter_name=Chapter1
    ```
    """
    try:
        content_type = request.headers.get("content-type", "")
        subject = "Subject"
        grade = 10
        chapter_name = "this chapter"
        reader = None

        # ── multipart/form-data (file upload) ─────────────────────────────
        if "multipart/form-data" in content_type:
            form = await request.form()
            file: Optional[UploadFile] = form.get("file")  # type: ignore
            subject = str(form.get("subject") or "Subject")
            grade   = int(form.get("grade") or 10)
            chapter_name = str(form.get("chapter_name") or "this chapter")

            if file is None or not hasattr(file, "read"):
                raise HTTPException(400, "'file' field is required for multipart upload.")

            pdf_bytes = await file.read()
            if not pdf_bytes:
                raise HTTPException(400, "Uploaded file is empty.")

            chapter_name = chapter_name or (file.filename or "chapter").rsplit(".", 1)[0]
            reader = PdfReader(io.BytesIO(pdf_bytes))

        # ── application/json (pdf_path URL or local) ───────────────────────
        else:
            body = await request.json()
            pdf_path   = (body.get("pdf_path") or "").strip()
            subject    = str(body.get("subject") or "Subject")
            grade      = int(body.get("grade") or 10)
            chapter_name = str(body.get("chapter_name") or "")

            if not pdf_path:
                raise HTTPException(400, "JSON body must include 'pdf_path'.")

            reader = _get_pdf_reader(pdf_path)
            if not chapter_name:
                chapter_name = pdf_path.rstrip("/").split("/")[-1].replace("%20", " ").split(".")[0]

        total_pages = len(reader.pages)

        # Skip first 3 pages (front matter / QR code instructions)
        start_page = min(3, total_pages - 1)
        text = ""
        for page in reader.pages[start_page:]:
            text += page.extract_text() or ""

        if not text.strip():  # fallback: try all pages
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""

        if not text.strip():
            raise HTTPException(400, "Could not extract text. Ensure it's a text-based PDF, not a scanned image.")

        topics = _extract_topics_for_chapter(
            text=text,
            chapter_name=chapter_name,
            subject=subject,
            grade=grade,
        )
        return {
            "topics": [t.model_dump() for t in topics],
            "total_pages": total_pages,
            "pages_analyzed": total_pages - start_page,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {str(e)}")


@router.post("/extract_textbook", summary="Full textbook PDF → chapters + topics")
async def extract_textbook(request: Request):
    """
    Full textbook PDF → detect all chapters → extract topics per chapter.

    Accepts TWO input formats:

    **Option A — JSON body (URL or local path):**
    ```json
    {
        "pdf_path": "https://...",
        "subject": "Biology",
        "grade": 10,
        "max_chapters": 30,
        "max_pages_per_chapter": 40
    }
    ```

    **Option B — File Upload (multipart/form-data):**
    ```
    file=<PDF binary>  subject=Biology  grade=10
    max_chapters=30    max_pages_per_chapter=40
    ```
    """
    try:
        content_type = request.headers.get("content-type", "")
        subject = "Subject"
        grade = 10
        max_chapters = 30
        max_pages_per_chapter = 40
        reader = None

        # ── multipart/form-data (file upload) ─────────────────────────────
        if "multipart/form-data" in content_type:
            form = await request.form()
            file: Optional[UploadFile] = form.get("file")  # type: ignore
            subject              = str(form.get("subject") or "Subject")
            grade                = int(form.get("grade") or 10)
            max_chapters         = int(form.get("max_chapters") or 30)
            max_pages_per_chapter = int(form.get("max_pages_per_chapter") or 40)

            if file is None or not hasattr(file, "read"):
                raise HTTPException(400, "'file' field is required for multipart upload.")

            pdf_bytes = await file.read()
            if not pdf_bytes:
                raise HTTPException(400, "Uploaded file is empty.")

            reader = PdfReader(io.BytesIO(pdf_bytes))

        # ── application/json (pdf_path URL or local) ───────────────────────
        else:
            body = await request.json()
            pdf_path              = (body.get("pdf_path") or "").strip()
            subject               = str(body.get("subject") or "Subject")
            grade                 = int(body.get("grade") or 10)
            max_chapters          = int(body.get("max_chapters") or 30)
            max_pages_per_chapter = int(body.get("max_pages_per_chapter") or 40)

            if not pdf_path:
                raise HTTPException(400, "JSON body must include 'pdf_path'.")

            # Auto-index for RAG (local files only)
            is_url = pdf_path.startswith(("http://", "https://"))
            if not is_url:
                try:
                    print(f"[segmentation] Auto-indexing local file: {pdf_path}")
                    rebuild_rag_index(pdf_path)
                except Exception as idx_err:
                    print(f"[segmentation] Auto-index skipped: {idx_err}")

            reader = _get_pdf_reader(pdf_path)

        total_pages = len(reader.pages)

        # ── Step 1: Detect chapters ────────────────────────────────────────
        raw_chapters = _detect_chapters_from_toc(reader)
        detection_method = "table_of_contents"

        if not raw_chapters:
            raw_chapters = _detect_chapters_by_scan(reader, max_chapters)
            detection_method = "page_scan"

        if not raw_chapters:
            raw_chapters = [{"chapter_name": "Full Textbook", "page_index": 0}]
            detection_method = "single_block_fallback"

        # ── Step 2: Build page ranges ──────────────────────────────────────
        chapters_with_ranges = _build_chapter_page_ranges(raw_chapters, total_pages)

        # ── Step 3: Extract topics per chapter ────────────────────────────
        results: List[ChapterResult] = []
        for i, ch in enumerate(chapters_with_ranges):
            chapter_text = _extract_chapter_text(
                reader,
                ch["start_page"],
                ch["end_page"],
                max_pages_per_chapter,
            )
            topics = _extract_topics_for_chapter(
                text=chapter_text,
                chapter_name=ch["chapter_name"],
                subject=subject,
                grade=grade,
            )
            results.append(ChapterResult(
                chapter_num=i + 1,
                chapter_name=ch["chapter_name"],
                start_page=ch["start_page"] + 1,
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
