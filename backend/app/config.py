
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    app_name: str = "IRIS API"
    app_version: str = "0.1.0"
    debug: bool = False
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'data' / 'iris.db').as_posix()}"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_email: str
    smtp_app_password: str

    groq_api_key: str
    groq_model: str = "openai/gpt-oss-120b"
    tavily_api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
