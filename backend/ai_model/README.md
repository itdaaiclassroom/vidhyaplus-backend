# AI API (Chatbot + Recommendations)

The frontend calls this server for the **AI Teaching Assistant** (chatbot) and for **YouTube/E-resource recommendations** in the teacher dashboard. If you see "AI server isn't running" or `net::ERR_CONNECTION_REFUSED` to port 8000, start this server.

## Run the AI server

From the project root:

```bash
cd backend/ai_model
python -m uvicorn api:app --reload --port 8000
```

Or from the `backend/ai_model` folder:

```bash
python -m uvicorn api:app --reload --port 8000
```

If you get missing-module errors, install dependencies:

```bash
cd backend/ai_model
pip install -r requirements.txt
```

Leave this terminal open. The API will be at **http://localhost:8000** (e.g. `/ask` for chatbot, `/recommend` for recommendations).

## Requirements

- Python 3.10+
- Dependencies: fastapi, uvicorn, sentence-transformers, faiss-cpu, transformers, etc. (see install command above)
- Optional: `syllabus_vectors.faiss` and `chunks.pkl` in `backend/ai_model/` for RAG. If missing, the server still starts; `/ask` will return "I couldn't find relevant content" until you add them (generate from your syllabus data).

## Environment

- Copy `.env.example` to `.env` in `backend/ai_model/` and set `YOUTUBE_API_KEY` (for recommendations). Optional: `CHATBOT_MODEL`, `RECO_TIMEOUT_SECONDS`.

## Frontend

The frontend uses `VITE_AI_API_URL` (default `http://localhost:8000`). Set it in the **frontend** root `.env` for dev; for production, set it to your deployed AI API URL so the chatbot and quiz generation can reach this server.
