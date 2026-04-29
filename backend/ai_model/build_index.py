"""
build_index.py  —  Run this ONCE to create syllabus_vectors.faiss + chunks.pkl
Usage:
    python build_index.py --pdf path/to/your_textbook.pdf

After running, restart the uvicorn server — the chatbot will use RAG context.
"""
import argparse
import pickle
from pathlib import Path

def build(pdf_path: str, chunk_size: int = 500, chunk_overlap: int = 100):
    from pypdf import PdfReader
    import faiss
    import numpy as np
    from sentence_transformers import SentenceTransformer
    import httpx
    import io

    if pdf_path.startswith(("http://", "https://")):
        print(f"[build_index] Downloading PDF from URL: {pdf_path}")
        response = httpx.get(pdf_path, follow_redirects=True, timeout=60.0)
        if response.status_code != 200:
            raise Exception(f"Failed to download PDF: HTTP {response.status_code}")
        reader = PdfReader(io.BytesIO(response.content))
    else:
        pdf = Path(pdf_path)
        if not pdf.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        print(f"[build_index] Reading local PDF: {pdf_path}")
        reader = PdfReader(str(pdf))

    full_text = ""
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        full_text += text + "\n"
    print(f"[build_index] Extracted {len(full_text)} characters from {len(reader.pages)} pages.")

    # Chunk the text
    chunks = []
    start = 0
    while start < len(full_text):
        end = start + chunk_size
        chunk = full_text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - chunk_overlap
    print(f"[build_index] Created {len(chunks)} chunks.")

    # Embed chunks
    print("[build_index] Loading embedding model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("[build_index] Embedding chunks... (this may take a minute)")
    embeddings = model.encode(chunks, show_progress_bar=True)
    embeddings = np.array(embeddings).astype("float32")

    # Build FAISS index
    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)
    print(f"[build_index] FAISS index built with {index.ntotal} vectors.")

    # Save index and chunks next to this script
    out_dir = Path(__file__).parent
    faiss.write_index(index, str(out_dir / "syllabus_vectors.faiss"))
    with open(out_dir / "chunks.pkl", "wb") as f:
        pickle.dump(chunks, f)

    print(f"[build_index] ✅ Saved: syllabus_vectors.faiss + chunks.pkl")
    print(f"[build_index] Now restart the uvicorn server to activate RAG.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build FAISS index from a PDF.")
    parser.add_argument(
        "--pdf",
        required=True,
        help="Path to the textbook/syllabus PDF file.",
    )
    parser.add_argument("--chunk-size", type=int, default=500)
    parser.add_argument("--chunk-overlap", type=int, default=100)
    args = parser.parse_args()
    build(args.pdf, args.chunk_size, args.chunk_overlap)
