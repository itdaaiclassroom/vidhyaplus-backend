"""Syllabus-aware chunking of textbook pages with chapter/period metadata."""
import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

# Chapter titles from syllabus for matching.
# SCERT PDFs often omit the "01." numbering in the running header; match both forms.
CHAPTER_PATTERNS = [
    (r"(?:01\.\s*)?INDIA\s*:\s*RELIEF\s*FEATURES|RELIEF\s*FEATURES", "01", "INDIA: RELIEF FEATURES"),
    (r"(?:02\.\s*)?IDEAS\s*OF\s*DEVELOPMENT", "02", "IDEAS OF DEVELOPMENT"),
    (r"(?:03\.\s*)?PRODUCTION\s*(?:&|AND)\s*EMPLOYMENT", "03", "PRODUCTION & EMPLOYMENT"),
    (r"(?:04\.\s*)?CLIMATE\s*OF\s*INDIA", "04", "CLIMATE OF INDIA"),
    (r"(?:05\.\s*)?RIVERS\s*(?:&|AND)\s*WATER", "05", "RIVERS & WATER"),
    (r"(?:06\.\s*)?POPULATION", "06", "POPULATION"),
    (r"(?:07\.\s*)?SETTLEMENTS\s*(?:&|AND)\s*MIGRATION", "07", "SETTLEMENTS & MIGRATION"),
    (r"(?:08\.\s*)?RAMPUR", "08", "RAMPUR"),
    (r"(?:09\.\s*)?GLOBALISATION|GLOBALIZATION", "09", "GLOBALISATION"),
    (r"(?:10\.\s*)?FOOD\s*SECURITY", "10", "FOOD SECURITY"),
    (r"(?:11\.\s*)?SUSTAINABLE\s*DEVELOPMENT", "11", "SUSTAINABLE DEVELOPMENT"),
    (r"(?:12\.\s*)?WORLD\s*WARS", "12", "WORLD WARS"),
    (r"(?:13\.\s*)?NATIONAL\s*LIBERATION", "13", "NATIONAL LIBERATION"),
    (r"(?:14\.\s*)?NATIONAL\s*MOVEMENT", "14", "NATIONAL MOVEMENT"),
    (r"(?:15\.\s*)?CONSTITUTION", "15", "CONSTITUTION"),
    (r"(?:16\.\s*)?ELECTIONS", "16", "ELECTIONS"),
    (r"(?:17\.\s*)?INDEPENDENT\s*INDIA", "17", "INDEPENDENT INDIA"),
    (r"(?:18\.\s*)?POLITICAL\s*TRENDS", "18", "POLITICAL TRENDS"),
    (r"(?:19\.\s*)?POST[- ]?WAR\s*WORLD", "19", "POST-WAR WORLD"),
    (r"(?:20\.\s*)?SOCIAL\s*MOVEMENTS", "20", "SOCIAL MOVEMENTS"),
    (r"(?:21\.\s*)?TELANGANA\s*MOVEMENT", "21", "TELANGANA MOVEMENT"),
]

CHUNK_SIZE = 600
CHUNK_OVERLAP = 100


@dataclass
class Chunk:
    text: str
    page_start: int
    page_end: int
    chapter_id: Optional[str]
    chapter_title: Optional[str]
    plan_section: Optional[str]  # P1..P8 when inferable


def _detect_chapter(line: str) -> Tuple[Optional[str], Optional[str]]:
    """Return (chapter_id, chapter_title) if line matches a chapter heading."""
    line_upper = line.upper().strip()
    for pattern, ch_id, title in CHAPTER_PATTERNS:
        if re.search(pattern, line_upper, re.IGNORECASE):
            return (ch_id, title)
    return (None, None)


def _split_into_sentences(text: str) -> List[str]:
    # Simple split on . ! ? followed by space or end
    parts = re.split(r'(?<=[.!?])\s+', text)
    return [p.strip() for p in parts if p.strip()]


def chunk_pages(
    pages: List[Tuple[int, str]],
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> List[Chunk]:
    """Split pages into chunks with syllabus metadata."""
    chunks: List[Chunk] = []
    current_chapter_id: Optional[str] = None
    current_chapter_title: Optional[str] = None
    current_plan: Optional[str] = None
    buffer: List[str] = []
    buffer_pages: List[int] = []
    char_count = 0

    for page_num, text in pages:
        lines = text.split("\n")
        for line in lines:
            ch_id, ch_title = _detect_chapter(line)
            if ch_id is not None:
                current_chapter_id = ch_id
                current_chapter_title = ch_title
                current_plan = None

            # Approximate tokens as chars/4
            line_len = len(line) + 1
            if char_count + line_len > chunk_size and buffer:
                chunk_text = "\n".join(buffer)
                chunks.append(
                    Chunk(
                        text=chunk_text,
                        page_start=min(buffer_pages),
                        page_end=max(buffer_pages),
                        chapter_id=current_chapter_id,
                        chapter_title=current_chapter_title,
                        plan_section=current_plan,
                    )
                )
                # Overlap: keep last few sentences
                sentences = _split_into_sentences(chunk_text)
                overlap_chars = 0
                keep: List[str] = []
                for s in reversed(sentences):
                    if overlap_chars + len(s) > overlap:
                        break
                    keep.append(s)
                    overlap_chars += len(s)
                buffer = list(reversed(keep)) if keep else []
                buffer_pages = [buffer_pages[-1]] if buffer_pages else []
                char_count = sum(len(x) for x in buffer)
            buffer.append(line)
            buffer_pages.append(page_num)
            char_count += line_len

    if buffer:
        chunk_text = "\n".join(buffer)
        chunks.append(
            Chunk(
                text=chunk_text,
                page_start=min(buffer_pages),
                page_end=max(buffer_pages),
                chapter_id=current_chapter_id,
                chapter_title=current_chapter_title,
                plan_section=current_plan,
            )
        )
    return chunks
