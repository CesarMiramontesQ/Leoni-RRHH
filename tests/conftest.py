# tests/conftest.py
"""
Fixtures base para toda la suite de tests de Plataforma RH Leoni Cable.

Estrategia de DB:
  - SQLite en memoria (sqlite+aiosqlite:///:memory:) — no requiere Docker ni PostgreSQL.
  - JSONB de PostgreSQL se sustituye con JSON nativo de SQLAlchemy usando un
    TypeDecorator compatible con SQLite (interceptado antes de la importacion de modelos).
  - Enums nativos de PG se declaran con native_enum=False en SQLite (el engine
    SQLite los trata como VARCHAR automaticamente).
  - Cada test recibe su propia transaccion con rollback automatico.

Integraciones mockeadas por defecto en el fixture `client`:
  - encolar_tress: AsyncMock para no requerir tabla tress_robot_queue con datos.
  - _log_action_background: AsyncMock para evitar sesiones secundarias en background.
"""

# ============================================================================
# CRITICO: El patch de JSONB debe ocurrir ANTES de importar cualquier modelo.
# ============================================================================
import sqlalchemy.dialects.postgresql as _pg_dialect
from sqlalchemy import JSON as _JSON

# Sustituir JSONB de PostgreSQL por JSON estandar antes de que los modelos lo importen
_pg_dialect.JSONB = _JSON  # type: ignore[attr-defined]

# Ahora si importamos el resto
import pytest
import pytest_asyncio
from datetime import date
from typing import AsyncGenerator
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Forzar importacion de todos los modelos para poblar Base.metadata
import app.models.catalogos  # noqa: F401
import app.models.empleados  # noqa: F401
import app.models.solicitudes  # noqa: F401
import app.models.auditoria  # noqa: F401
import app.models.roles  # noqa: F401
import app.models.comedor  # noqa: F401
import app.models.tress  # noqa: F401
import app.models.incidencias  # noqa: F401
import app.models.actas  # noqa: F401
import app.models.notificaciones  # noqa: F401
import app.models.emails  # noqa: F401
import app.models.talento  # noqa: F401
import app.models.level_up  # noqa: F401
import app.models.vacaciones  # noqa: F401
import app.models.bono_historico_import_log  # noqa: F401
import app.models.turnos_empleados  # noqa: F401

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


# ---------------------------------------------------------------------------
# Engine — scope session (una sola DB en memoria para toda la suite)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(scope="session")
async def engine():
    """
    AsyncEngine SQLite en memoria, compartido por la sesion de tests.
    Las tablas se crean al inicio y se eliminan al final.
    SQLite maneja los Enum como TEXT y JSONB como TEXT (via el patch anterior).
    """
    _engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield _engine

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await _engine.dispose()


# ---------------------------------------------------------------------------
# DB session — rollback por test
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def db(engine) -> AsyncGenerator[AsyncSession, None]:
    """
    AsyncSession con rollback automatico al finalizar cada test.
    Garantiza aislamiento completo entre tests sin recrear el schema.
    """
    AsyncTestSession = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with AsyncTestSession() as session:
        await session.begin()
        try:
            yield session
        finally:
            await session.rollback()


# ---------------------------------------------------------------------------
# HTTP client con DB override
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    AsyncClient (httpx) conectado a la aplicacion FastAPI con la sesion de test
    inyectada via dependency override.

    Integraciones externas mockeadas:
      - encolar_tress: no inserta en tress_robot_queue
      - _log_action_background: no abre sesion secundaria
    """

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    with (
        patch(
            "app.integrations.tress.queue.encolar_tress",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.utils.audit_logger._log_action_background",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as ac:
            yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Factories de datos de prueba
# ---------------------------------------------------------------------------

async def _get_or_create_rol(db: AsyncSession, nombre: str):
    """Obtiene o crea un Rol por nombre en la transaccion activa."""
    from sqlalchemy import select
    from app.models.roles import Rol

    result = await db.execute(select(Rol).where(Rol.nombre == nombre))
    rol = result.scalar_one_or_none()
    if not rol:
        rol = Rol(nombre=nombre, permisos={})
        db.add(rol)
        await db.flush()
        await db.refresh(rol)
    return rol


async def make_empleado(
    db: AsyncSession,
    *,
    rol: str = "empleado",
    email: str | None = None,
    usuario: str | None = None,
    no_empleado: str | None = None,
    empleado_id: int | None = None,
    nombre: str = "Test Usuario",
    password: str = "Passw0rd!Seguro",
    lider_id: int | None = None,
    estado_id: int = 1,
    clasificacion_id: int | None = None,
    fecha_fin_contrato: date | None = None,
    dias_vacaciones: int | None = 30,
    puede_administrar_permisos_rh: bool = False,
    modulos_rh: dict | None = None,
    puesto_id: int | None = None,
):
    """
    Factory para crear un Empleado con Rol asociado.
    Genera identificadores unicos automaticamente para evitar colisiones entre tests.
    ``lider_id`` debe ser el ``empleado_id`` del líder (no el ``id`` local).
    """
    import uuid
    from app.models.empleados import Empleado

    uid = str(uuid.uuid4())[:8]
    _email = email or f"emp_{uid}@leoni.test"
    _no_empleado = no_empleado or f"EMP-{uid}"
    _empleado_id = empleado_id or abs(hash(uid)) % 100000

    rol_obj = await _get_or_create_rol(db, rol)

    empleado = Empleado(
        empleado_id=_empleado_id,
        no_empleado=_no_empleado,
        nombre=nombre,
        email=_email,
        usuario=usuario,
        password_hash=hash_password(password),
        rol_id=rol_obj.id,
        lider_id=lider_id,
        estado_id=estado_id,
        clasificacion_id=clasificacion_id,
        fecha_fin_contrato=fecha_fin_contrato,
        puede_administrar_permisos_rh=puede_administrar_permisos_rh,
        modulos_rh=modulos_rh or {},
        puesto_id=puesto_id,
    )
    db.add(empleado)
    await db.flush()
    await db.refresh(empleado)
    empleado.rol = rol_obj

    if dias_vacaciones is not None:
        from app.models.vacaciones import Vacaciones

        db.add(
            Vacaciones(empleado_id=empleado.id, dias_disponibles=dias_vacaciones)
        )
        await db.flush()

    return empleado


async def link_turno_comedor_empleado(
    db: AsyncSession,
    empleado,
    comedor_id: int,
    *,
    turno: str = "G1",
    clasificacion: str | None = "A",
) -> None:
    """Vincula empleado con código de comedor en `turnos_empleados` (reservas automáticas)."""
    from app.models.turnos_empleados import TurnoEmpleado

    db.add(
        TurnoEmpleado(
            no_empleado=empleado.no_empleado,
            nombre=empleado.nombre,
            clasificacion=clasificacion,
            comedor=comedor_id,
            turno=turno,
        )
    )
    await db.flush()


async def make_clasificacion_administrativo(db: AsyncSession):
    """Catálogo Administrativo (código A) para pruebas de Home Office."""
    from app.models.catalogos import ClasificacionEmpleado

    cl = ClasificacionEmpleado(
        clasificacion_id=901,
        descripcion="A",
        significado="Administrativo",
        estatus_id=1,
    )
    db.add(cl)
    await db.flush()
    return cl


async def make_solicitud(
    db: AsyncSession,
    *,
    empleado_id: int,
    tipo: str = "vacaciones",
    estado: str = "pending",
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    nivel_actual: int = 1,
    comentarios: str | None = None,
):
    """Factory para crear una Solicitud directamente en DB (sin pasar por el Service)."""
    from app.models.solicitudes import Solicitud

    solicitud = Solicitud(
        empleado_id=empleado_id,
        tipo=tipo,
        fecha_inicio=fecha_inicio or date(2026, 4, 7),
        fecha_fin=fecha_fin or date(2026, 4, 11),
        estado=estado,
        nivel_actual=nivel_actual,
        comentarios=comentarios,
    )
    db.add(solicitud)
    await db.flush()
    await db.refresh(solicitud)
    return solicitud


async def make_incidencia(
    db: AsyncSession,
    *,
    empleado_id: int,
    tipo: str = "tardanza",
    detalle: str = "Incidencia de prueba generada en test",
):
    """Factory para crear una Incidencia directamente en DB."""
    from app.models.incidencias import Incidencia

    incidencia = Incidencia(
        tipo=tipo,
        empleado_id=empleado_id,
        detalle=detalle,
    )
    db.add(incidencia)
    await db.flush()
    await db.refresh(incidencia)
    return incidencia


async def auth_headers(
    client: AsyncClient,
    empleado,
    password: str = "Passw0rd!Seguro",
) -> dict:
    """
    Realiza login del empleado via el endpoint /api/v1/auth/login y retorna
    el header Authorization con el Bearer token.
    """
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": empleado.email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200, (
        f"Login fallido para {empleado.email}: "
        f"status={response.status_code} body={response.text}"
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Fixtures de empleados por rol (conveniencia)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def empleado_base(db):
    return await make_empleado(db, rol="empleado", nombre="Carlos López")


@pytest_asyncio.fixture
async def empleado_supervisor(db):
    return await make_empleado(db, rol="supervisor", nombre="Ana Martínez")


@pytest_asyncio.fixture
async def empleado_rh(db):
    return await make_empleado(db, rol="rh", nombre="Lucía Fernández")


@pytest_asyncio.fixture
async def empleado_director(db):
    return await make_empleado(db, rol="director", nombre="Roberto Díaz")


@pytest_asyncio.fixture
async def empleado_gerente(db):
    return await make_empleado(db, rol="gerente", nombre="Sofía Ruiz")
