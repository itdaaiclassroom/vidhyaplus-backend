"""
build_index.py  —  CLI tool to build/add a FAISS index from a PDF.

Usage (still works as before, now adds to multi-doc registry):
    python build_index.py --pdf path/to/textbook.pdf --label "Science Class 8"

Or use the API (recommended for production):
    POST http://localhost:8001/ingest  with form field: file=<pdf>

After running, the AI server hot-reloads — no restart needed.
"""
import argparse
from pathlib import Path


def build(pdf_path: str, label: str | None = None, chunk_size: int = 500, chunk_overlap: int = 100):
    """Add a PDF to the multi-doc registry via the ingest module."""
    pdf = Path(pdf_path)
    if not pdf.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc_label = label or pdf.stem
    print(f"[build_index] Ingesting '{doc_label}' from: {pdf_path}")

    with open(pdf, "rb") as f:
        content = f.read()

    # Use the ingest module so the doc lands in indexes/ with manifest entry
    from ingest import ingest_bytes
    entry = ingest_bytes(content, doc_label, source_type="pdf", source_url=str(pdf))

    print(f"[build_index] ✅ Done! Document ID: {entry['id']}, Chunks: {entry['chunk_count']}")
    print(f"[build_index] If the AI server is running, it will hot-reload automatically.")
    print(f"[build_index] To add more documents: python build_index.py --pdf another.pdf")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Add a PDF to the VidhyaPlus AI multi-doc knowledge base.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python build_index.py --pdf science_8.pdf
  python build_index.py --pdf english.pdf --label "English Class 10"
  python build_index.py --pdf social.pdf --label "Social Studies Class 9"

Multiple PDFs are supported — each gets its own index.
The AI chatbot searches across ALL indexed documents simultaneously.
        """,
    )
    parser.add_argument("--pdf", required=True, help="Path to the PDF file.")
    parser.add_argument("--label", default=None, help="Human-readable name for this document (optional).")
    parser.add_argument("--chunk-size", type=int, default=500)
    parser.add_argument("--chunk-overlap", type=int, default=100)
    args = parser.parse_args()
    build(args.pdf, args.label, args.chunk_size, args.chunk_overlap)
