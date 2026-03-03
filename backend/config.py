from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

# .env lives in the project root (one level up from backend/)
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o"
    database_url: str = "sqlite+aiosqlite:///./data/investment.db"
    summary_interval_minutes: int = 60
    backend_port: int = 8000

    class Config:
        env_file = str(_ENV_FILE)
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings():
    return Settings()
