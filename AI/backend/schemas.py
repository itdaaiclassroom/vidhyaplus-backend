from pydantic import BaseModel
from typing import List, Literal, Optional


class HealthResponse(BaseModel):
    status: str


class ChatRequest(BaseModel):
    question: str
    chapter_id: Optional[str] = None  # e.g. "01", "02", ..., "21"
    period_id: Optional[str] = None  # e.g. "P1".."P8"
    mode: Literal["chat", "reference_helper"] = "chat"


class SourceMetadata(BaseModel):
    chapter_id: Optional[str] = None
    chapter_title: Optional[str] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceMetadata] = []
    used_chapter_id: Optional[str] = None
    used_period_id: Optional[str] = None


class YoutubeItem(BaseModel):
    title: str
    url: str
    channel: Optional[str] = None
    duration: Optional[str] = None


class ResourceItem(BaseModel):
    title: str
    url: str
    source: Optional[str] = None
    snippet: Optional[str] = None


class ReferenceRequest(BaseModel):
    question: str
    chapter_id: Optional[str] = None
    period_id: Optional[str] = None


class ReferenceResponse(BaseModel):
    youtube: List[YoutubeItem]
    resources: List[ResourceItem]

