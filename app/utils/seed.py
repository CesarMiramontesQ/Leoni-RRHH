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


# ── Admin inicial ─────────────────────────────────────────────────────────────
# Cambiar la password despues del primer login via endpoint de cambio de password.
# Este usuario no se modifica en ejecuciones posteriores del seed.

ADMIN_RH: dict = {
    "num_empleado": "RH-0001",
    "nombre": "Admin",
    "apellido": "RH",
    "email": "admin.rh@leoni.com",
    "password": "Leoni2026!RH",
    "departamento": "Recursos Humanos",
    "puesto": "Administrador del Sistema",
}


# ── Logica del seed ───────────────────────────────────────────────────────────

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
    """Crea el usuario admin RH si no existe. No lo modifica si ya existe."""
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
        num_empleado=ADMIN_RH["num_empleado"],
        nombre=ADMIN_RH["nombre"],
        apellido=ADMIN_RH["apellido"],
        email=ADMIN_RH["email"],
        password_hash=hash_password(ADMIN_RH["password"]),
        departamento=ADMIN_RH["departamento"],
        puesto=ADMIN_RH["puesto"],
        rol_id=rol_rh_id,
        activo=True,
    )
    db.add(admin)
    await db.flush()
    logger.info(
        "  Admin RH creado (id=%d, email=%s)",
        admin.id,
        admin.email,
    )
    logger.warning(
        "  IMPORTANTE: Cambiar la password del admin RH despues del primer login."
    )


async def seed() -> None:
    """Punto de entrada principal del seed. Idempotente."""
    logger.info("=== Iniciando seed — Plataforma RH Leoni Cable ===")

    async with AsyncSessionLocal() as db:
        try:
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
