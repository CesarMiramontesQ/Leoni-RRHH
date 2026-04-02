from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://leoni:leoni_dev_pass@localhost:5432/leoni_rh"

    # JWT
    JWT_SECRET: str = "change-this-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7

    # SMTP
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # Ollama LLM
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    OLLAMA_TEMPERATURE: float = 0.3

    # Lectores de huella — IPs autorizadas separadas por coma; vacío = permite todo (dev)
    HUELLA_WHITELIST_IPS: List[str] = []

    # TRESS SQL Server (Windows only)
    TRESS_ODBC_CONN: str = ""

    # IT Mirror DB
    IT_MIRROR_DB_URL: str = ""
    IT_SYNC_INTERVAL_MINUTES: int = 30

    # Estados que se consideran "empleado activo" — ajustar en producción
    ESTADOS_ACTIVOS_IDS: List[int] = [1]

    @field_validator("ESTADOS_ACTIVOS_IDS", mode="before")
    @classmethod
    def parse_estados_activos(cls, v):
        if isinstance(v, str):
            if not v.strip():
                return [1]
            return [int(x.strip()) for x in v.split(",") if x.strip()]
        return v

    # App
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000

    @field_validator("HUELLA_WHITELIST_IPS", mode="before")
    @classmethod
    def parse_huella_ips(cls, v):
        if isinstance(v, str):
            if not v.strip():
                return []
            return [ip.strip() for ip in v.split(",") if ip.strip()]
        return v


settings = Settings()
