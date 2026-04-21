"""Search YouTube and return direct video URLs (max 5).
Priority:
1) YouTube Data API (if YOUTUBE_API_KEY set)
2) SerpAPI (if SERPAPI_KEY set)
3) ddgs (DuckDuckGo replacement) fallback
"""
from typing import List, Optional
import re
import httpx

from backend.config import settings
from backend.schemas import YoutubeItem


def _to_watch_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def _search_youtube_api(query: str, max_results: int) -> Optional[List[YoutubeItem]]:
    api_key = settings.youtube_api_key
    if not api_key:
        return None
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": str(max_results),
        "key": api_key,
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get("https://www.googleapis.com/youtube/v3/search", params=params)
            r.raise_for_status()
            data = r.json()
        out: List[YoutubeItem] = []
        for item in data.get("items", []):
            vid = (item.get("id") or {}).get("videoId")
            if not vid:
                continue
            snippet = item.get("snippet") or {}
            out.append(
                YoutubeItem(
                    title=snippet.get("title") or "YouTube video",
                    url=_to_watch_url(vid),
                    channel=snippet.get("channelTitle"),
                    duration=None,
                )
            )
        return out[:max_results]
    except Exception:
        return None


def _search_serpapi(query: str, max_results: int) -> Optional[List[YoutubeItem]]:
    key = settings.serpapi_key
    if not key:
        return None
    params = {
        "engine": "youtube",
        "search_query": query,
        "api_key": key,
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get("https://serpapi.com/search", params=params)
            r.raise_for_status()
            data = r.json()
        out: List[YoutubeItem] = []
        for res in data.get("video_results", [])[:max_results]:
            url = res.get("link")
            title = res.get("title") or "YouTube video"
            channel = (res.get("channel") or {}).get("name")
            if not url:
                continue
            out.append(YoutubeItem(title=title, url=url, channel=channel, duration=None))
        return out[:max_results]
    except Exception:
        return None


def _search_ddgs(query: str, max_results: int) -> List[YoutubeItem]:
    try:
        from ddgs import DDGS  # type: ignore
    except Exception:
        return []
    out: List[YoutubeItem] = []
    seen: set[str] = set()
    q = f"{query} site:youtube.com"
    with DDGS() as ddgs:
        for r in ddgs.text(q, max_results=max_results * 5):
            url = (r.get("href") or r.get("link") or "").strip()
            if not url or ("youtube.com" not in url and "youtu.be" not in url):
                continue
            m = re.search(r"[?&]v=([a-zA-Z0-9_-]{11})", url)
            if m:
                url = _to_watch_url(m.group(1))
            if url in seen:
                continue
            seen.add(url)
            out.append(YoutubeItem(title=r.get("title") or "YouTube video", url=url, channel=None, duration=None))
            if len(out) >= max_results:
                break
    return out[:max_results]


def search_youtube(query: str, max_results: int = 5) -> List[YoutubeItem]:
    return (
        _search_youtube_api(query, max_results)
        or _search_serpapi(query, max_results)
        or _search_ddgs(query, max_results)
        or []
    )
