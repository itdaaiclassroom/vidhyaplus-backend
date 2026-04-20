import os
from pathlib import Path


def _root() -> Path:
    return Path(__file__).resolve().parent.parent


class Settings:
    def __init__(self) -> None:
        self.project_root: Path = _root()
        self.data_dir: Path = self.project_root / "data"
        self.textbook_pdf: Path = self.project_root / "Social_textbook_10.pdf"
        self.vector_store_dir: Path = self.data_dir / "vector_store"
        self.llama_backend: str = os.environ.get("SOCIAL10_LLAMA_BACKEND", "ollama")
        self.llama_model: str = os.environ.get("SOCIAL10_LLAMA_MODEL", "llama3")
        self.frontend_origin: str = os.environ.get("SOCIAL10_FRONTEND_ORIGIN", "http://localhost:5173")
        # Search provider API keys (optional)
        self.youtube_api_key: str | None = os.environ.get("YOUTUBE_API_KEY") or None
        self.google_cse_id: str | None = os.environ.get("GOOGLE_CSE_ID") or None
        self.google_api_key: str | None = os.environ.get("GOOGLE_API_KEY") or None
        self.serpapi_key: str | None = os.environ.get("SERPAPI_KEY") or None


settings = Settings()
