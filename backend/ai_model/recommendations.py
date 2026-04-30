"""
recommendations.py — YouTube video + E-resource recommendations
===============================================================

Routes:
  POST /recommend  — Returns ranked YouTube videos + educational resources

LLM/Search priority:
  1. YouTube Data API v3 (if YOUTUBE_API_KEY set)
  2. DuckDuckGo web search fallback (no key needed)
"""

import os
import warnings
from concurrent.futures import ThreadPoolExecutor, wait
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus

from fastapi import APIRouter
from pydantic import BaseModel
from sentence_transformers import util

try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

try:
    from googleapiclient.discovery import build as yt_build
    from googleapiclient.errors import HttpError
except ImportError:
    yt_build = None
    HttpError = Exception

# Load .env so YOUTUBE_API_KEY is always available
_env_path = Path(__file__).resolve().parent / ".env"
try:
    from dotenv import load_dotenv
    load_dotenv(_env_path)
except ImportError:
    pass

from shared_embeddings import embedding_model

# ---------------------------------------------------------------------------
# YouTube client setup
# ---------------------------------------------------------------------------

_yt_key = (os.environ.get("YOUTUBE_API_KEY") or "").strip()
YOUTUBE_API_KEY = _yt_key if _yt_key and _yt_key not in ("", "YOUR_YOUTUBE_API_KEY") else None

youtube = None
if YOUTUBE_API_KEY and yt_build:
    try:
        youtube = yt_build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
        print(f"[recommendations] ✅ YouTube Data API v3 client ready.")
    except Exception as e:
        print(f"[recommendations] ⚠️  YouTube client init failed: {str(e)[:80]}")

if not youtube:
    print("[recommendations] ⚠️  YouTube API key missing — using DuckDuckGo fallback.")

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RecommendQuery(BaseModel):
    topic: Optional[str] = None
    subject: Optional[str] = None
    grade: Optional[int] = None
    chapter: Optional[str] = None
    # backward-compat: old clients send { query }
    query: Optional[str] = None


# ---------------------------------------------------------------------------
# Query builder
# ---------------------------------------------------------------------------

_SUBJECT_MAP = {
    "phys": "Physics", "bio": "Biology", "chem": "Chemistry",
    "math": "Mathematics", "social": "Social Studies", "hist": "History",
    "geo": "Geography", "eng": "English", "sci": "Science",
}


def _normalize_subject(subject: Optional[str]) -> Optional[str]:
    if not subject:
        return None
    s = subject.strip().lower()
    for key, val in _SUBJECT_MAP.items():
        if key in s:
            return val
    return subject.strip() or None


def build_search_query(topic: Optional[str], subject: Optional[str],
                       grade: Optional[int], chapter: Optional[str],
                       fallback: Optional[str]) -> str:
    """Build a focused, relevant query for YouTube + DDG search."""
    subj = _normalize_subject(subject)
    t = (topic or "").strip() or (chapter or "").strip() or (fallback or "").strip()
    g = grade if grade else 10
    parts = [p for p in [subj, t, f"class {g}", "NCERT", "CBSE"] if p and str(p).strip()]
    return " ".join(parts).strip() or f"class {g} NCERT education"


# ---------------------------------------------------------------------------
# YouTube search
# ---------------------------------------------------------------------------

def search_youtube(query: str) -> list:
    """
    Search YouTube for educational videos.
    Uses YouTube Data API v3 if key is set, else DuckDuckGo fallback.
    Returns list of { title, description, url, thumbnail }.
    """
    if youtube:
        try:
            request = youtube.search().list(
                q=f"{query} explanation",
                part="snippet",
                type="video",
                maxResults=20,
                order="relevance",
                safeSearch="moderate",
                relevanceLanguage="en",
                videoDuration="medium",
            )
            response = request.execute()
            videos = []
            for item in response.get("items", []):
                vid = item.get("id", {}).get("videoId")
                if not vid:
                    continue
                snip = item.get("snippet") or {}
                title = (snip.get("title") or "").strip()
                if not title:
                    continue
                thumb = (snip.get("thumbnails", {}).get("medium", {}).get("url", ""))
                videos.append({
                    "title": title,
                    "description": (snip.get("description") or "")[:300],
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "thumbnail": thumb,
                    "source": "youtube_api",
                })
            print(f"[recommendations] YouTube API: {len(videos)} videos found.")
            return videos
        except Exception as e:
            print(f"[recommendations] YouTube API error: {str(e)[:100]}")

    # DuckDuckGo fallback
    print("[recommendations] Using DuckDuckGo YouTube fallback.")
    videos = []
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with DDGS() as ddgs:
                results = ddgs.text(f"site:youtube.com/watch {query} class explanation", max_results=15)
        for r in results:
            url = (r.get("href") or "").strip()
            if not url.startswith("https://www.youtube.com/watch?v="):
                continue
            title = (r.get("title") or "").strip()
            if not title:
                continue
            videos.append({
                "title": title,
                "description": (r.get("body") or "")[:300],
                "url": url,
                "thumbnail": "",
                "source": "duckduckgo_fallback",
            })
    except Exception as e:
        print(f"[recommendations] DuckDuckGo error: {str(e)[:100]}")

    return videos


# ---------------------------------------------------------------------------
# E-resource search
# ---------------------------------------------------------------------------

_PROMINENT_RESOURCES = [
    {
        "title": "DIKSHA – Government Learning Portal",
        "url": "https://diksha.gov.in/",
        "snippet": "Official learning resources by class and subject.",
    },
    {
        "title": "NCERT Official Textbooks (Free PDF)",
        "url": "https://ncert.nic.in/textbook.php",
        "snippet": "Download chapter-wise PDFs for all subjects.",
    },
    {
        "title": "ePathshala – NCERT Digital Resources",
        "url": "https://epathshala.nic.in/",
        "snippet": "E-books and digital resources for school education.",
    },
    {
        "title": "NROER – Open Educational Resources",
        "url": "https://nroer.gov.in/home/",
        "snippet": "National Repository of Open Educational Resources.",
    },
]


def search_resources(query: str) -> list:
    """Search DuckDuckGo for PDF notes and educational resources."""
    resources = []
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with DDGS() as ddgs:
                results = ddgs.text(f"{query} notes pdf CBSE NCERT", max_results=8)
        for r in results:
            url = (r.get("href") or "").strip()
            title = (r.get("title") or "").strip()
            if url and title:
                resources.append({
                    "title": title,
                    "url": url,
                    "snippet": (r.get("body") or "")[:200],
                })
    except Exception as e:
        print(f"[recommendations] Resources search error: {str(e)[:100]}")
    return resources


# ---------------------------------------------------------------------------
# Semantic ranking
# ---------------------------------------------------------------------------

def rank_items(query: str, items: list) -> list:
    """Rank items by semantic similarity to query using embedding model."""
    if not items:
        return []
    try:
        texts = [
            (item.get("title") or "") + " " + (item.get("description") or item.get("snippet") or "")
            for item in items
        ]
        q_emb = embedding_model.encode(query, convert_to_tensor=True, show_progress_bar=False)
        i_emb = embedding_model.encode(texts, convert_to_tensor=True, show_progress_bar=False)
        scores = util.cos_sim(q_emb, i_emb)[0]
        scored = sorted(enumerate(items), key=lambda x: scores[x[0]].item(), reverse=True)
        return [item for _, item in scored]
    except Exception:
        return items


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["recommendations"])


@router.post("/recommend", summary="Get YouTube videos and educational resources")
def recommend(q: RecommendQuery):
    """
    Returns ranked YouTube videos and educational resource links for a topic.

    **Search priority:**
    1. YouTube Data API v3 (if YOUTUBE_API_KEY configured)
    2. DuckDuckGo fallback (no key needed)

    Returns:
    - `videos`: top 5 ranked YouTube video links (real watch URLs)
    - `resources`: top 5 educational resource links
    - `query_used`: the search query that was built
    """
    query = build_search_query(q.topic, q.subject, q.grade, q.chapter, q.query)
    print(f"[recommendations] Query: {query}")

    timeout_s = float(os.environ.get("RECO_TIMEOUT_SECONDS") or "15")

    # Run YouTube search synchronously (most important)
    videos = []
    try:
        videos = search_youtube(query)
    except Exception as e:
        print(f"[recommendations] YouTube exception: {e}")

    # Run resource search in parallel with ranking
    resources = []
    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            fut = ex.submit(search_resources, query)
            done, _ = wait([fut], timeout=timeout_s)
            if fut in done:
                resources = fut.result() or []
    except Exception as e:
        print(f"[recommendations] Resources exception: {e}")

    # Semantic ranking
    try:
        ranked_videos = rank_items(query, videos)[:10]
    except Exception:
        ranked_videos = videos[:10]

    try:
        ranked_resources = rank_items(query, resources)[:8]
    except Exception:
        ranked_resources = resources[:8]

    # Filter: only return real YouTube watch URLs
    ranked_videos = [
        v for v in ranked_videos
        if (v.get("url") or "").startswith("https://www.youtube.com/watch?v=")
    ][:5]

    # Merge prominent official links + DDG results
    seen_urls = {p["url"] for p in _PROMINENT_RESOURCES}
    ddg_extra = [r for r in ranked_resources if r.get("url") and r.get("url") not in seen_urls]
    final_resources = (_PROMINENT_RESOURCES + ddg_extra)[:5]

    return {
        "videos": ranked_videos,
        "resources": final_resources,
        "query_used": query,
        "youtube_source": "youtube_api" if youtube else "duckduckgo_fallback",
    }
