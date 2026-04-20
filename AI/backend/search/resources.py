"""Search e-resources (articles, publications, notes) and return up to 5 links.
Priority:
1) Google Custom Search (if GOOGLE_API_KEY & GOOGLE_CSE_ID set)
2) SerpAPI (if SERPAPI_KEY set)
3) ddgs fallback
"""
from typing import List, Optional
import httpx

from backend.config import settings
from backend.schemas import ResourceItem

_PREFERRED_DOMAINS = [
    "scert.telangana.gov.in",
    "tsbie.cgg.gov.in",
    "sakshi.com",
    "education.sakshi.com",
    "ncert.nic.in",
    "cbse.gov.in",
    "gov.in",
]


def _domain_score(url: str) -> int:
    u = (url or "").lower()
    score = 0
    if "filetype=pdf" in u or u.endswith(".pdf"):
        score += 3
    for d in _PREFERRED_DOMAINS:
        if d in u:
            score += 5
    # de-prioritize spammy/low-signal hosts
    if "pinterest." in u or "facebook." in u or "instagram." in u:
        score -= 5
    return score


def _search_google_cse(query: str, max_results: int) -> Optional[List[ResourceItem]]:
    key = settings.google_api_key
    cse_id = settings.google_cse_id
    if not key or not cse_id:
        return None
    params = {"key": key, "cx": cse_id, "q": query, "num": str(max_results)}
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get("https://www.googleapis.com/customsearch/v1", params=params)
            r.raise_for_status()
            data = r.json()
        tmp: List[ResourceItem] = []
        for item in data.get("items", []):
            tmp.append(
                ResourceItem(
                    title=item.get("title") or "Resource",
                    url=item.get("link") or "",
                    source=item.get("displayLink") or item.get("title"),
                    snippet=item.get("snippet"),
                )
            )
        tmp.sort(key=lambda x: _domain_score(x.url), reverse=True)
        return tmp[:max_results]
    except Exception:
        return None


def _search_serpapi(query: str, max_results: int) -> Optional[List[ResourceItem]]:
    key = settings.serpapi_key
    if not key:
        return None
    params = {"engine": "google", "q": query, "api_key": key, "num": max_results}
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get("https://serpapi.com/search", params=params)
            r.raise_for_status()
            data = r.json()
        tmp: List[ResourceItem] = []
        for res in data.get("organic_results", []):
            tmp.append(
                ResourceItem(
                    title=res.get("title") or "Resource",
                    url=res.get("link") or "",
                    source=res.get("source") or res.get("displayed_link"),
                    snippet=res.get("snippet"),
                )
            )
        tmp.sort(key=lambda x: _domain_score(x.url), reverse=True)
        return tmp[:max_results]
    except Exception:
        return None


def _search_ddgs(query: str, max_results: int) -> List[ResourceItem]:
    try:
        from ddgs import DDGS  # type: ignore
    except Exception:
        return []
    results: List[ResourceItem] = []
    seen: set[str] = set()
    # Bias toward textbook-like resources and PDFs
    q = f"{query} (pdf OR notes OR scert OR sakshi OR ncert)"
    with DDGS() as ddgs:
        for r in ddgs.text(q, max_results=max_results * 5):
            url = (r.get("href") or r.get("link") or "").strip()
            if not url or "youtube.com" in url or "youtu.be" in url:
                continue
            if url in seen:
                continue
            seen.add(url)
            results.append(
                ResourceItem(
                    title=r.get("title") or "Resource",
                    url=url,
                    source=r.get("source") or r.get("title"),
                    snippet=r.get("body"),
                )
            )
    results.sort(key=lambda x: _domain_score(x.url), reverse=True)
    return results[:max_results]


def search_e_resources(query: str, max_results: int = 5) -> List[ResourceItem]:
    return (
        _search_google_cse(query, max_results)
        or _search_serpapi(query, max_results)
        or _search_ddgs(query, max_results)
        or []
    )
