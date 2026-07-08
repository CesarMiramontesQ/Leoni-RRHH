# Base fijada a bookworm (Debian 12): Microsoft solo publica el ODBC Driver 18 para
# distros LTS. En trixie (Debian 13) la verificación GPG estricta (sqv) rechaza la
# firma del repo de MS y `msodbcsql18` no se instala.
FROM python:3.12-slim-bookworm AS base

WORKDIR /app

# gcc/libpq-dev para asyncpg/psycopg2; ODBC Driver 18 de Microsoft para SQL Server
# (BD datos-analisis, solo lectura). El prod.list de MS ya trae `signed-by`, así que
# se descarga tal cual (sin inyectar la clave con sed).
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl gnupg ca-certificates && \
    curl -sSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg && \
    curl -sSL https://packages.microsoft.com/config/debian/12/prod.list -o /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 unixodbc-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# --- Production ---
FROM base AS production
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# --- Development (with reload) ---
FROM base AS development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# --- Tests ---
FROM base AS test
CMD ["pytest", "--tb=short", "-q"]
