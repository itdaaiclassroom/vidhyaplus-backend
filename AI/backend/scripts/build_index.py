"""Build vector index from Social_textbook_10.pdf. Run from project root: python -m backend.scripts.build_index"""
import sys
from pathlib import Path

# Ensure backend is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import settings
from backend.rag.loader import load_pdf_pages
from backend.rag.chunker import chunk_pages
from backend.rag.embedder import Embedder
from backend.rag.store import build_and_persist_store


def main():
    pdf_path = settings.textbook_pdf
    if not pdf_path.exists():
        print(f"Textbook not found: {pdf_path}")
        print("Place Social_textbook_10.pdf in the project root (d:\\AI) and run again.")
        sys.exit(1)
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.vector_store_dir.mkdir(parents=True, exist_ok=True)
    print("Loading PDF...")
    pages = load_pdf_pages(pdf_path)
    print(f"Loaded {len(pages)} pages.")
    chunks = chunk_pages(pages)
    print(f"Created {len(chunks)} chunks.")
    print("Embedding and persisting to Chroma...")
    build_and_persist_store(chunks, settings.vector_store_dir)
    print("Done. Vector store at:", settings.vector_store_dir)


if __name__ == "__main__":
    main()
