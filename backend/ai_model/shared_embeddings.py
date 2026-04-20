"""Shared embedding model for chatbot and recommendations to avoid loading twice."""
from sentence_transformers import SentenceTransformer

print("[shared] Loading embedding model (once)...")
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
