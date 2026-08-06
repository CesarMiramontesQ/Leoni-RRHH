from __future__ import annotations

from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit


def build_asyncpg_url(
    host: str,
    port: int | str,
    name: str,
    user: str,
    password: str,
    engine: str = "postgresql",
) -> str | None:
    """
    Arma la URL asyncpg desde componentes individuales (host, puerto, BD, usuario,
    contraseña). Función pura sin dependencia de `config`, reutilizable desde
    `app.core.config` y el cliente de lectura de Bono.

    Devuelve ``None`` si faltan datos mínimos (host, nombre o usuario), de modo que
    el llamador decida el fallback. Aplica ``quote_plus`` a usuario y contraseña para
    soportar caracteres especiales (`@`, `:`, `/`).
    """
    if not (host and name and user):
        return None
    eng = (engine or "postgresql").strip().lower()
    if eng not in ("postgresql", "postgres"):
        raise ValueError(
            "BONO_DB_ENGINE debe ser 'postgresql' o 'postgres'; "
            f"recibido: {engine!r}"
        )
    return (
        f"postgresql+asyncpg://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host.strip()}:{int(port)}/{name.strip()}"
    )


DEFAULT_MSSQL_CONNECT_TIMEOUT = 5


def mssql_connect_args(connect_timeout: int = DEFAULT_MSSQL_CONNECT_TIMEOUT) -> dict:
    """`connect_args` para `create_async_engine` que acota el login a SQL Server.

    Acota **solo el establecimiento de la conexión**, no la ejecución de las
    consultas. Sin esto aplica el default del driver (15 s) y cada petición que
    toque la BD se cuelga ese tiempo completo cuando el servidor no responde —
    que es lo que dejaba el dashboard del empleado en 15 s por carga. Con el
    servidor sano la conexión tarda milisegundos, así que un valor bajo no
    penaliza el camino feliz.

    Va por `connect_args` y no en la cadena ODBC a propósito: el driver **ignora**
    `Connection Timeout=N` en el connection string (medido: 15 s igual), mientras
    que `timeout` llega a `pyodbc.connect()` y sí se respeta (medido: 3 s con 3).
    """
    return {"timeout": max(1, int(connect_timeout))}


def build_mssql_aioodbc_url(
    host: str,
    port: int | str,
    name: str,
    user: str,
    password: str,
    driver: str = "ODBC Driver 18 for SQL Server",
    trust_cert: bool = True,
    mars: bool = True,
) -> str | None:
    """
    Arma la URL SQLAlchemy ``mssql+aioodbc`` desde componentes individuales.

    SQL Server usa ``SERVER=host,puerto`` (coma, no dos puntos) y el ODBC Driver 18
    exige cifrado por defecto; para servidores on-premise / contenedores con certificado
    self-signed se envía ``TrustServerCertificate=yes;Encrypt=no``.

    ``mars=True`` activa ``MARS_Connection=yes`` (Multiple Active Result Sets), necesario
    para batches T-SQL con varios resultsets (EXEC de SPs + SELECT final).

    El timeout de conexión **no** va aquí: el driver ignora ``Connection Timeout``
    en la cadena. Se pasa por ``connect_args`` con `mssql_connect_args()`.

    Devuelve ``None`` si faltan datos mínimos (host, nombre o usuario), de modo que el
    llamador decida el fallback. La cadena ODBC completa se pasa URL-encoded en el
    parámetro ``odbc_connect`` para soportar cualquier carácter especial.
    """
    if not (host and name and user):
        return None
    encrypt = "no"  # dev/on-prem; sube a "yes" si el server tiene cert válido
    mars_flag = "yes" if mars else "no"
    odbc = (
        f"DRIVER={{{driver}}};SERVER={host.strip()},{int(port)};"
        f"DATABASE={name.strip()};UID={user};PWD={password};"
        f"TrustServerCertificate={'yes' if trust_cert else 'no'};Encrypt={encrypt};"
        f"MARS_Connection={mars_flag}"
    )
    return f"mssql+aioodbc:///?odbc_connect={quote_plus(odbc)}"


def normalizar_url_y_connect_args(url: str) -> tuple[str, dict]:
    """
    Normaliza parámetros de conexión para URLs asyncpg.

    asyncpg no acepta `sslmode` como kwarg directo. Si viene en el query string,
    se remueve de la URL y se mapea a `connect_args["ssl"]`.
    """
    if "postgresql+asyncpg://" not in url:
        return url, {}

    parsed = urlsplit(url)
    query_params = parse_qsl(parsed.query, keep_blank_values=True)

    connect_args: dict = {}
    rebuilt_query: list[tuple[str, str]] = []

    for key, value in query_params:
        if key.lower() != "sslmode":
            rebuilt_query.append((key, value))
            continue

        mode = value.strip().lower()
        # `disable` => sin TLS; cualquier otro modo activa TLS en asyncpg.
        connect_args["ssl"] = mode != "disable"

    new_query = urlencode(rebuilt_query, doseq=True)
    sanitized_url = urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, new_query, parsed.fragment)
    )

    return sanitized_url, connect_args
