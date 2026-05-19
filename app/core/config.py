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

    # PostgreSQL bono_productividad (solo lectura; independiente de DATABASE_URL)
    BONO_DB_HOST: str = ""
    BONO_DB_PORT: int = 5433
    BONO_DB_NAME: str = ""
    BONO_DB_USER: str = ""
    BONO_DB_PASSWORD: str = ""
    BONO_DB_ENGINE: str = "postgresql"

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
    OLLAMA_MODEL: str = "gemma4:e4b"
    OLLAMA_TEMPERATURE: float = 0.3
    # Temperatura dedicada a redacción formal de actas (consistencia, tono legal).
    OLLAMA_ACTA_TEMPERATURE: float = 0.2
    # Timeout cliente HTTP → Ollama (generación puede superar 45s con PDF+RAG+pregunta pesada).
    OLLAMA_HTTP_TIMEOUT: float = 180.0
    # Limita tokens de salida para acabar antes y reducir 500 por tiempo de espera interno.
    OLLAMA_NUM_PREDICT: int = 1536
    # Escrito de apoyo (mejorar-ia): varias secciones + acta completa; 1536 suele truncar.
    OLLAMA_ACTA_NUM_PREDICT: int = 4096
    # Ventana de contexto (tokens) para /api/chat y /api/generate. Si Ollama loguea
    # "truncating input prompt" limit=4096, sube este valor (p. ej. 16384) para actas+RAG.
    OLLAMA_NUM_CTX: int = 16384
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"

    # Legal RAG (Chroma + LangChain; ingest vía scripts/actas_rag/ingest.py)
    LEGAL_RAG_CHROMA_PATH: str = "storage/legal-rag-chroma"
    LEGAL_RAG_CHUNK_SIZE: int = 1000
    LEGAL_RAG_CHUNK_OVERLAP: int = 200
    # Fragmentos recuperados por consulta (subir si el prompt legal queda “vacío”).
    LEGAL_RAG_TOP_K: int = 12
    # Score mínimo de relevancia Chroma/LangChain (0-1 aprox.). Si ningún chunk
    # supera este umbral, se considera que no hay cobertura legal suficiente.
    LEGAL_RAG_SCORE_THRESHOLD: float = 0.45
    # Caracteres por fragmento enviado al LLM tras similarity_search (antes 750 fijo;
    # debe ser >= LEGAL_RAG_CHUNK_SIZE para no truncar el chunk íntegro).
    LEGAL_RAG_SNIPPET_MAX_CHARS: int = 1600
    # Máximo de caracteres totales del marco legal inyectados en el prompt (varios chunks).
    LEGAL_REFERENCE_PROMPT_MAX_CHARS: int = 15000
    # Si la descripción de hechos es enorme, se trunca solo para la llamada a IA.
    ACTA_DESCRIPCION_IA_MAX_CHARS: int = 8000

    # Stitch (Google design tool) — opcional
    STITCH_API_KEY: str = ""

    # Lectores de huella — IPs autorizadas separadas por coma; vacío = permite todo (dev)
    HUELLA_WHITELIST_IPS: List[str] = []

    # Terminal comedor / torniquete (usuario+contraseña). Si vacío, se usa HUELLA_WHITELIST_IPS.
    COMEDOR_TERMINAL_IPS: List[str] = []

    # Zona horaria para "hoy" en reservas y terminal de comedor
    APP_TIMEZONE: str = "America/Mexico_City"

    # Ventana opcional HH:MM (24h); vacío = sin restricción horaria
    COMEDOR_ACCESO_HORA_INICIO: str = ""
    COMEDOR_ACCESO_HORA_FIN: str = ""

    # Si no está vacío, los endpoints de terminal exigen header X-Torniquete-Key
    TORNIQUETE_API_KEY: str = ""

    # TRESS SQL Server (Windows only)
    TRESS_ODBC_CONN: str = ""

    # IT Mirror DB
    IT_MIRROR_DB_URL: str = ""
    IT_SYNC_INTERVAL_MINUTES: int = 30

    # Estados que se consideran "empleado activo" — ajustar en producción
    ESTADOS_ACTIVOS_IDS: List[int] = [1]
    # Estados mostrados como "Permiso" en filtros de líderes (p. ej. Suspendido)
    ESTADOS_PERMISO_IDS: List[int] = [3]

    @field_validator("ESTADOS_ACTIVOS_IDS", mode="before")
    @classmethod
    def parse_estados_activos(cls, v):
        if isinstance(v, str):
            if not v.strip():
                return [1]
            return [int(x.strip()) for x in v.split(",") if x.strip()]
        return v

    @field_validator("ESTADOS_PERMISO_IDS", mode="before")
    @classmethod
    def parse_estados_permiso(cls, v):
        if isinstance(v, str):
            if not v.strip():
                return [3]
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

    @field_validator("COMEDOR_TERMINAL_IPS", mode="before")
    @classmethod
    def parse_comedor_terminal_ips(cls, v):
        if isinstance(v, str):
            if not v.strip():
                return []
            return [ip.strip() for ip in v.split(",") if ip.strip()]
        return v

    # Stitch (Google design tool) — opcional
    STITCH_API_KEY: str = ""


settings = Settings()
