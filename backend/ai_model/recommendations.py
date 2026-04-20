"""Recommendations module: YouTube + DuckDuckGo + ranking. POST /recommend returns { videos, resources }."""
import os
from concurrent.futures import ThreadPoolExecutor, wait
from pathlib import Path
from urllib.parse import quote_plus

try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS
from fastapi import APIRouter
from pydantic import BaseModel
from sentence_transformers import util
from typing import Optional

try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    build = None
    HttpError = Exception  # fallback for type refs

# Load .env first so YOUTUBE_API_KEY is available before any other imports that might use it
_env_path = Path(__file__).resolve().parent / ".env"
try:
    from dotenv import load_dotenv
    loaded = load_dotenv(_env_path)
    if not _env_path.exists():
        print(f"[recommendations] WARNING: .env not found at {_env_path}")
    elif loaded:
        print(f"[recommendations] Loaded .env from {_env_path}")
except ImportError:
    pass

# Read key immediately after loading .env
_raw_yt_key = (os.environ.get("YOUTUBE_API_KEY") or "").strip()
YOUTUBE_API_KEY = _raw_yt_key if _raw_yt_key and _raw_yt_key != "YOUR_YOUTUBE_API_KEY" else None
from shared_embeddings import embedding_model

youtube = None
if YOUTUBE_API_KEY and build:
    try:
        youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
        print("[recommendations] YouTube client: OK (key loaded)")
    except Exception as e:
        print(f"[recommendations] YouTube client init failed: {str(e)[:80]}")
if not youtube:
    print("[recommendations] YouTube: NOT configured (set YOUTUBE_API_KEY in backend/ai_model/.env)")


class RecommendQuery(BaseModel):
    # Backward compatible: old clients send { query }
    query: Optional[str] = None
    # New: teacher live session sends { topic, subject, grade }
    topic: Optional[str] = None
    subject: Optional[str] = None
    grade: Optional[int] = None
    chapter: Optional[str] = None


def _normalize_subject(subject: Optional[str]) -> Optional[str]:
    if not subject:
        return None
    s = subject.strip().lower()
    if "phys" in s:
        return "Physics"
    if "bio" in s:
        return "Biology"
    if "social" in s:
        return "Social Studies"
    return subject.strip() or None


def build_reco_query(topic: Optional[str], subject: Optional[str], grade: Optional[int], fallback: Optional[str]) -> str:
    """Build a focused query for YouTube + E-resources using the live-session context."""
    subj = _normalize_subject(subject)
    t = (topic or "").strip()
    if not t:
        t = (fallback or "").strip()
    g = grade if grade else 10
    parts = [p for p in [subj, t, f"class {g}", "NCERT", "CBSE"] if p and str(p).strip()]
    return " ".join(parts).strip() or f"class {g} NCERT"


def search_youtube(query: str):
    """Use YouTube Data API v3 for real video results. Returns empty only on API error."""
    if not youtube:
        print("[recommendations] YouTube API key missing; using DDG YouTube fallback.")
        videos = []
        search_query = f"site:youtube.com/watch {query} class 10 explanation"
        try:
            import warnings
            with warnings.catch_warnings(action="ignore"):
                with DDGS() as ddgs:
                    results = ddgs.text(search_query, max_results=12)
            for r in results:
                url = (r.get("href") or "").strip()
                if not url.startswith("https://www.youtube.com/watch?v="):
                    continue
                title = (r.get("title") or "").strip()
                if not title:
                    continue
                videos.append({
                    "title": title,
                    "description": (r.get("body") or "")[:500],
                    "url": url,
                })
        except Exception as e:
            print(f"[recommendations] DDG YouTube fallback error: {str(e)[:120]}")
        return videos
    search_query = f"{query} class 10 explanation"
    try:
        request = youtube.search().list(
            q=search_query,
            part="snippet",
            type="video",
            maxResults=20,
            order="relevance",
            safeSearch="moderate",
            relevanceLanguage="en",
        )
        response = request.execute()
    except HttpError as e:
        print(f"[recommendations] YouTube API error: {e}")
        return []
    items = response.get("items", [])
    print(f"[recommendations] YouTube API returned {len(items)} items for query: {search_query[:50]}...")
    videos = []
    for item in items:
        vid = item.get("id", {}).get("videoId")
        if not vid:
            continue
        snip = item.get("snippet") or {}
        title = (snip.get("title") or "").strip()
        if not title:
            continue
        videos.append({
            "title": title,
            "description": (snip.get("description") or "")[:500],
            "url": f"https://www.youtube.com/watch?v={vid}",
        })
    return videos


def search_resources(query: str):
    resources = []
    # Prefer PDFs/notes that match the current subject/topic
    search_query = f"{query} notes pdf"
    try:
        import warnings
        with warnings.catch_warnings(action="ignore"):
            with DDGS() as ddgs:
                results = ddgs.text(search_query, max_results=6)
            for r in results:
                resources.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                })
    except Exception:
        pass
    return resources


def rank_items(query: str, items: list) -> list:
    """Batch encode for speed; rank by relevance to query."""
    if not items:
        return []
    texts = [(item.get("title") or "") + " " + (item.get("description") or item.get("snippet") or "") for item in items]
    query_emb = embedding_model.encode(query, convert_to_tensor=True, show_progress_bar=False)
    item_embs = embedding_model.encode(texts, convert_to_tensor=True, show_progress_bar=False)
    scores = util.cos_sim(query_emb, item_embs)[0]
    scored = [(scores[i].item(), items[i]) for i in range(len(items))]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [x[1] for x in scored]


router = APIRouter(tags=["recommendations"])


@router.post("/recommend")
def recommend(q: RecommendQuery):
    query = build_reco_query(q.topic, q.subject, q.grade, q.query)
    # Run YouTube first so it's not cancelled by DDG slowness; then run DDG in parallel with ranking
    videos = []
    try:
        videos = search_youtube(query)
    except Exception as e:
        print(f"[recommendations] YouTube search exception: {e}")
    timeout_s = float(os.environ.get("RECO_TIMEOUT_SECONDS") or "15")
    resources = []
    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            fut_r = ex.submit(search_resources, query)
            done, _ = wait([fut_r], timeout=timeout_s)
            if fut_r in done:
                resources = fut_r.result() or []
    except Exception as e:
        print(f"[recommendations] Resources search exception: {e}")
    try:
        ranked_videos = rank_items(query, videos)[:5]
    except Exception as e:
        print(f"[recommendations] Rank videos exception: {e}")
        ranked_videos = videos[:5]
    try:
        ranked_resources = rank_items(query, resources)[:5]
    except Exception as e:
        print(f"[recommendations] Rank resources exception: {e}")
        ranked_resources = resources[:5]

    # Only return real YouTube watch URLs (direct video links, not search pages)
    ranked_videos = [v for v in ranked_videos if (v.get("url") or "").startswith("https://www.youtube.com/watch?v=")]
    # E-resources: always include prominent official links first, then DDG results
    prominent = [
        {"title": "DIKSHA – Government Learning Portal", "url": "https://diksha.gov.in/", "snippet": "Official learning resources by class and subject."},
        {"title": "NCERT Official Textbooks", "url": "https://ncert.nic.in/textbook.php", "snippet": "Download chapter-wise PDFs for all subjects."},
        {"title": "ePathshala – NCERT Digital Resources", "url": "https://epathshala.nic.in/", "snippet": "E-books and resources for school education."},
        {"title": "NROER – Open Educational Resources", "url": "https://nroer.gov.in/home/", "snippet": "National Repository of OER for teachers and students."},
    ]
    combined_resources = prominent + [r for r in ranked_resources if r.get("url") and r.get("url") not in [p["url"] for p in prominent]]
    ranked_resources = combined_resources[:10]
    return {"videos": ranked_videos[:5], "resources": ranked_resources[:5]}
