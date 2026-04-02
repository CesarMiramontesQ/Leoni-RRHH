# app/utils/seed.py
"""
Script de seed idempotente — Plataforma RH Leoni Cable.

Crea:
  - 5 roles con permisos JSONB completos
  - 1 usuario RH admin inicial

Idempotente: ejecutar multiples veces no duplica datos.
Los permisos de roles existentes se ACTUALIZAN en cada ejecucion para
reflejar el schema de permisos definido en ARCHITECTURE.md.

Uso:
    python -m app.utils.seed
"""

import asyncio
import logging

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.catalogos import (
    Area,
    Categoria,
    ClasificacionEmpleado,
    EstadoEmpleado,
    Puesto,
    Subarea,
)
from app.models.empleados import Empleado
from app.models.roles import Rol

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


# ── Definicion de roles y permisos ────────────────────────────────────────────
# Schema JSONB canonico — toda clave debe estar presente en los 5 roles.
# Modificar este diccionario es la unica forma autorizada de cambiar permisos.

ROLES_SEED: list[dict] = [
    {
        "nombre": "empleado",
        "permisos": {
            "solicitudes": {
                "crear": True,
                "ver_propias": True,
                "ver_equipo": False,
                "ver_todas": False,
                "aprobar": False,
                "override": False,
            },
            "incidencias": {
                "crear": False,
                "ver_propias": True,
                "ver_todas": False,
                "resolver": False,
            },
            "actas": {
                "generar": False,
                "firmar": True,
                "ver": False,
            },
            "comedor": {
                "registrar_huella": False,
                "ver_menu": True,
                "administrar": False,
            },
            "reportes": {
                "ver_propios": True,
                "ver_todos": False,
                "exportar": False,
            },
            "empleados": {
                "ver": False,
                "editar": False,
                "crear": False,
            },
            "auditoria": {
                "ver": False,
            },
        },
    },
    {
        "nombre": "supervisor",
        "permisos": {
            "solicitudes": {
                "crear": True,
                "ver_propias": True,
                "ver_equipo": True,
                "ver_todas": False,
                "aprobar": True,
                "override": False,
            },
            "incidencias": {
                "crear": True,
                "ver_propias": True,
                "ver_todas": False,
                "resolver": False,
            },
            "actas": {
                "generar": False,
                "firmar": True,
                "ver": True,
            },
            "comedor": {
                "registrar_huella": False,
                "ver_menu": True,
                "administrar": False,
            },
            "reportes": {
                "ver_propios": True,
                "ver_todos": False,
                "exportar": False,
            },
            "empleados": {
                "ver": True,
                "editar": False,
                "crear": False,
            },
            "auditoria": {
                "ver": False,
            },
        },
    },
    {
        "nombre": "gerente",
        "permisos": {
            "solicitudes": {
                "crear": True,
                "ver_propias": True,
                "ver_equipo": True,
                "ver_todas": False,
                "aprobar": True,
                "override": False,
            },
            "incidencias": {
                "crear": True,
                "ver_propias": True,
                "ver_todas": True,
                "resolver": True,
            },
            "actas": {
                "generar": True,
                "firmar": True,
                "ver": True,
            },
            "comedor": {
                "registrar_huella": False,
                "ver_menu": True,
                "administrar": False,
            },
            "reportes": {
                "ver_propios": True,
                "ver_todos": True,
                "exportar": True,
            },
            "empleados": {
                "ver": True,
                "editar": False,
                "crear": False,
            },
            "auditoria": {
                "ver": False,
            },
        },
    },
    {
        "nombre": "director",
        "permisos": {
            "solicitudes": {
                "crear": True,
                "ver_propias": True,
                "ver_equipo": True,
                "ver_todas": True,
                "aprobar": True,
                "override": True,
            },
            "incidencias": {
                "crear": True,
                "ver_propias": True,
                "ver_todas": True,
                "resolver": True,
            },
            "actas": {
                "generar": True,
                "firmar": True,
                "ver": True,
            },
            "comedor": {
                "registrar_huella": False,
                "ver_menu": True,
                "administrar": False,
            },
            "reportes": {
                "ver_propios": True,
                "ver_todos": True,
                "exportar": True,
            },
            "empleados": {
                "ver": True,
                "editar": True,
                "crear": False,
            },
            "auditoria": {
                "ver": True,
            },
        },
    },
    {
        "nombre": "rh",
        "permisos": {
            "solicitudes": {
                "crear": True,
                "ver_propias": True,
                "ver_equipo": True,
                "ver_todas": True,
                "aprobar": True,
                "override": True,
            },
            "incidencias": {
                "crear": True,
                "ver_propias": True,
                "ver_todas": True,
                "resolver": True,
            },
            "actas": {
                "generar": True,
                "firmar": True,
                "ver": True,
            },
            "comedor": {
                "registrar_huella": False,
                "ver_menu": True,
                "administrar": True,
            },
            "reportes": {
                "ver_propios": True,
                "ver_todos": True,
                "exportar": True,
            },
            "empleados": {
                "ver": True,
                "editar": True,
                "crear": True,
            },
            "auditoria": {
                "ver": True,
            },
        },
    },
]


CATALOGOS_SEED: dict = {
    "areas": [
        {"area_id": 1, "descripcion": "Producción", "estatus_id": 1},
        {"area_id": 2, "descripcion": "Administración", "estatus_id": 1},
    ],
    "categorias": [
        {
            "categoria_id": 1,
            "descripcion": "Operativo",
            "nivel": "N1",
            "bono_cat": None,
            "estatus_id": 1,
        },
        {
            "categoria_id": 2,
            "descripcion": "Administrativo",
            "nivel": "N2",
            "bono_cat": None,
            "estatus_id": 1,
        },
    ],
    "subareas": [
        {"subarea_id": 1, "descripcion": "Línea A", "area_id": 1, "estatus_id": 1},
        {"subarea_id": 2, "descripcion": "Contabilidad", "area_id": 2, "estatus_id": 1},
    ],
    "puestos": [
        {"puesto_id": 1, "descripcion": "Operador", "estatus_id": 1, "area_id": 1},
        {"puesto_id": 2, "descripcion": "Analista", "estatus_id": 1, "area_id": 2},
    ],
    "estados_empleados": [
        {"estado_id": 1, "descripcion": "Activo", "estatus_id": 1},
        {"estado_id": 2, "descripcion": "Baja", "estatus_id": 1},
        {"estado_id": 3, "descripcion": "Suspendido", "estatus_id": 1},
    ],
    "clasificaciones": [
        {
            "clasificacion_id": 1,
            "descripcion": "Directo",
            "estatus_id": 1,
            "significado": "Personal directo de producción",
        },
        {
            "clasificacion_id": 2,
            "descripcion": "Indirecto",
            "estatus_id": 1,
            "significado": "Personal de soporte",
        },
    ],
}


# ── Admin inicial ─────────────────────────────────────────────────────────────
# Cambiar la password despues del primer login via endpoint de cambio de password.
# Este usuario no se modifica en ejecuciones posteriores del seed.

ADMIN_RH: dict = {
    "empleado_id": 9999,
    "no_empleado": "RH-0001",
    "nombre": "Admin RH",
    "email": "admin.rh@leoni.com",
    "usuario": "admin.rh",
    "password": "Leoni2026!RH",
    "estado_id": 1,
}


# ── Logica del seed ───────────────────────────────────────────────────────────


async def seed_catalogos(db) -> None:
    """Crea datos de catálogos mínimos para development. Idempotente por PK."""
    plan = [
        ("areas", Area, "area_id", CATALOGOS_SEED["areas"]),
        ("categorias", Categoria, "categoria_id", CATALOGOS_SEED["categorias"]),
        ("subareas", Subarea, "subarea_id", CATALOGOS_SEED["subareas"]),
        ("puestos", Puesto, "puesto_id", CATALOGOS_SEED["puestos"]),
        ("estados_empleados", EstadoEmpleado, "estado_id", CATALOGOS_SEED["estados_empleados"]),
        (
            "clasificaciones",
            ClasificacionEmpleado,
            "clasificacion_id",
            CATALOGOS_SEED["clasificaciones"],
        ),
    ]

    for nombre, Model, pk_field, rows in plan:
        for row in rows:
            pk_value = row[pk_field]
            result = await db.execute(
                select(Model).where(getattr(Model, pk_field) == pk_value)
            )
            existing = result.scalar_one_or_none()
            if not existing:
                db.add(Model(**row))
                logger.info("  %s id=%d creado", nombre, pk_value)
        await db.flush()
    logger.info("Catálogos seed completado")


async def seed_roles(db) -> dict[str, int]:
    """Crea o actualiza los 5 roles. Retorna mapa nombre→id."""
    created: dict[str, int] = {}

    for rol_data in ROLES_SEED:
        result = await db.execute(
            select(Rol).where(Rol.nombre == rol_data["nombre"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Actualizar permisos para reflejar el schema actual
            existing.permisos = rol_data["permisos"]
            await db.flush()
            created[rol_data["nombre"]] = existing.id
            logger.info("  Rol '%s' actualizado (id=%d)", rol_data["nombre"], existing.id)
        else:
            rol = Rol(nombre=rol_data["nombre"], permisos=rol_data["permisos"])
            db.add(rol)
            await db.flush()
            created[rol_data["nombre"]] = rol.id
            logger.info("  Rol '%s' creado (id=%d)", rol_data["nombre"], rol.id)

    return created


async def seed_admin(db, rol_rh_id: int) -> None:
    """Crea el usuario admin RH si no existe."""
    result = await db.execute(
        select(Empleado).where(Empleado.email == ADMIN_RH["email"])
    )
    existing = result.scalar_one_or_none()

    if existing:
        logger.info(
            "  Admin RH ya existe (id=%d, email=%s) — sin cambios",
            existing.id,
            existing.email,
        )
        return

    admin = Empleado(
        empleado_id=ADMIN_RH["empleado_id"],
        no_empleado=ADMIN_RH["no_empleado"],
        nombre=ADMIN_RH["nombre"],
        email=ADMIN_RH["email"],
        usuario=ADMIN_RH["usuario"],
        password_hash=hash_password(ADMIN_RH["password"]),
        rol_id=rol_rh_id,
        estado_id=ADMIN_RH["estado_id"],
    )
    db.add(admin)
    await db.flush()
    logger.info("  Admin RH creado (id=%d, email=%s)", admin.id, admin.email)
    logger.warning(
        "  IMPORTANTE: Cambiar la password del admin RH después del primer login."
    )


async def seed() -> None:
    """Punto de entrada principal del seed. Idempotente."""
    logger.info("=== Iniciando seed — Plataforma RH Leoni Cable ===")

    async with AsyncSessionLocal() as db:
        try:
            logger.info("Seeding catálogos...")
            await seed_catalogos(db)

            logger.info("Seeding roles...")
            created_roles = await seed_roles(db)

            logger.info("Seeding usuario admin RH...")
            rol_rh_id = created_roles.get("rh")
            if not rol_rh_id:
                raise RuntimeError("El rol 'rh' no fue creado correctamente")
            await seed_admin(db, rol_rh_id)

            await db.commit()
            logger.info("=== Seed completado exitosamente ===")

        except Exception:
            await db.rollback()
            logger.exception("Error durante el seed — rollback ejecutado")
            raise


if __name__ == "__main__":
    asyncio.run(seed())
