import faiss
import pickle
import numpy as np
from sentence_transformers import SentenceTransformer
from transformers import pipeline

# Load embedding model
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Load FAISS index
index = faiss.read_index("syllabus_vectors.faiss")

# Load chunks
with open("chunks.pkl", "rb") as f:
    chunks = pickle.load(f)

# Load LLM
llm = pipeline(
    "text-generation",
    model="tiiuae/falcon-rw-1b"
)

def retrieve_chunks(question, k=3):
    question_embedding = embedding_model.encode([question])
    D, I = index.search(np.array(question_embedding), k)
    return [chunks[i] for i in I[0]]

def ask_model(question):

    retrieved = retrieve_chunks(question)

    context = "\n".join(retrieved)

    prompt = f"""
You are a 10th class AI teaching assistant.

Answer only from the syllabus context.

Context:
{context}

Question:
{question}

Answer:
"""

    response = llm(
        prompt,
        max_new_tokens=150,
        temperature=0.3
    )

    generated = response[0]["generated_text"]

    if "Answer:" in generated:
        generated = generated.split("Answer:")[-1]

    return generated.strip()