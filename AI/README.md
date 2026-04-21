# Class 10 Social Studies RAG Tutor

RAG-based tutor for 10th class Social Studies: answers from the textbook only, plus 5 YouTube and 5 e-resource references per topic.

## Setup

### 1. Backend (Python)

```bash
cd d:\AI
python -m venv venv
venv\Scripts\activate
pip install -r backend\requirements.txt
```

- Place **Social_textbook_10.pdf** in the project root (`d:\AI\`).
- Build the vector index (one-time, or after changing the PDF):

  ```bash
  python -m backend.scripts.build_index
  ```

- Run [Ollama](https://ollama.ai/) locally and pull a model:

  ```bash
  ollama pull llama3
  ollama serve   # if not already running
  ```

- Start the API:

  ```bash
  uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
  ```

### 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The app proxies `/api` and `/health` to the backend (port 8000).

## Features

- **AI Chatbot**: Ask questions; answers are based only on the textbook (RAG). Optionally restrict by chapter/period from the syllabus.
- **Reference Helper**: Enter a topic (or use the last chatbot question); get 5 YouTube links (direct watch URLs) and 5 e-resources (articles, notes).

## API

- `GET /health` — health check
- `GET /api/chapters` — list of chapters (syllabus)
- `POST /api/chat` — body: `{ "question", "chapter_id?", "period_id?" }` → answer + sources
- `POST /api/references` — body: `{ "question", "chapter_id?", "period_id?" }` → `{ "youtube": [...], "resources": [...] }`
- `POST /admin/rebuild_index` — rebuild vector index from the PDF

## Optional: API keys for faster, higher quality references

Set these environment variables before running the backend (PowerShell example):

```powershell
$env:YOUTUBE_API_KEY="your_youtube_data_api_key"
$env:GOOGLE_API_KEY="your_google_api_key"
$env:GOOGLE_CSE_ID="your_programmable_search_engine_id"
# or SerpAPI as an alternative:
$env:SERPAPI_KEY="your_serpapi_key"
```

Provider order:
- YouTube references: YouTube Data API → SerpAPI → ddgs fallback
- E-resources: Google Custom Search → SerpAPI → ddgs fallback
