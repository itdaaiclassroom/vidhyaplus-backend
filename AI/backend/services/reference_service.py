"""Reference helper: get 5 YouTube + 5 e-resources for a question using RAG context for topic."""
from typing import Optional

from backend.rag.retriever import RAGRetriever
from backend.rag.embedder import Embedder
from backend.config import settings
from backend.search.youtube import search_youtube
from backend.search.resources import search_e_resources
from backend.schemas import YoutubeItem, ResourceItem

# Chapter titles for search query enrichment
CHAPTER_TOPICS = {
    "01": "India relief features location latitudes longitudes geological Himalayas plains plateau",
    "02": "ideas of development HDI goals public facilities",
    "03": "production employment sectors primary secondary tertiary organized unorganized",
    "04": "climate of India monsoon seasons rainfall",
    "05": "rivers water Himalayan peninsular irrigation",
    "06": "population growth density literacy migration",
    "07": "settlements migration rural urban",
    "08": "Rampur village farming credit",
    "09": "globalisation liberalisation MNCs",
    "10": "food security PDS buffer stock",
    "11": "sustainable development resources conservation",
    "12": "world wars WW1 WW2",
    "13": "national liberation movements",
    "14": "national movement freedom struggle",
    "15": "constitution features",
    "16": "elections process",
    "17": "independent India development",
    "18": "political trends",
    "19": "post-war world cold war",
    "20": "social movements",
    "21": "Telangana movement",
}


def get_references(
    question: str,
    chapter_id: Optional[str] = None,
    max_youtube: int = 5,
    max_resources: int = 5,
) -> tuple[list[YoutubeItem], list[ResourceItem]]:
    """Build topic query from question + optional chapter, return 5 YouTube + 5 e-resources."""
    base = question.strip()
    # Constrain to Class 10 Social Studies context
    suffix = " Class 10 Social Studies AP/CBSE syllabus Telangana SSC"
    topic = f"{base}{suffix}"
    if chapter_id and chapter_id in CHAPTER_TOPICS:
        topic = f"{topic} {CHAPTER_TOPICS[chapter_id]}"
    yt = search_youtube(topic, max_results=max_youtube)
    res = search_e_resources(topic, max_results=max_resources)
    return (yt, res)
