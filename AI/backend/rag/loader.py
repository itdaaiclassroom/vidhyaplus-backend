"""Load text from Social_textbook_10.pdf using pypdf."""
from pathlib import Path
from typing import List, Tuple


def load_pdf_pages(pdf_path: Path) -> List[Tuple[int, str]]:
    """Extract text per page. Returns list of (page_number_1based, text)."""
    try:
        from pypdf import PdfReader
    except ImportError:
        raise ImportError("Install pypdf: pip install pypdf")

    if not pdf_path.exists():
        return []

    reader = PdfReader(str(pdf_path))
    result: List[Tuple[int, str]] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        result.append((i + 1, text))
    return result
