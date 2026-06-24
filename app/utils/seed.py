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

from app.core.config import settings
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
from app.models.level_up import (
    Capacidad,
    CategoriaCapacidad,
    CategoriaCurso,
    Curso,
    Habilidad,
    TipoHabilidad,
)
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

DEV_USER: dict = {
    "empleado_id": 9998,
    "no_empleado": "RH-0002",
    "nombre": "Alberto Flores",
    "email": "alberto.flores@leoni.com",
    "usuario": "alberto.flores",
    "password": "Dev2026!",
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


async def seed_user(db, user_data: dict, rol_id: int, label: str) -> None:
    """Crea/asegura un usuario. rol, email y password viven en levelup_empleados_core;
    `empleados` (Bono) solo guarda identidad. En Bono real el empleado ya existe; en
    dev/local se crea para conveniencia."""
    from app.models.empleados_rh import ensure_core

    existing = await db.execute(
        select(Empleado).where(Empleado.empleado_id == user_data["empleado_id"])
    )
    emp = existing.scalar_one_or_none()

    if emp is None:
        if settings.APP_ENV == "production":
            raise RuntimeError(
                f"No existe empleado_id={user_data['empleado_id']} en Bono.empleados. "
                "Configure SEED_ADMIN_EMPLEADO_ID en .env con un empleado activo existente."
            )
        # Dev/local: no hay Bono, se crea la fila identidad.
        emp = Empleado(
            empleado_id=user_data["empleado_id"],
            no_empleado=user_data["no_empleado"],
            nombre=user_data["nombre"],
            usuario=user_data["usuario"],
            estado_id=user_data["estado_id"],
        )
        db.add(emp)
        await db.flush()

    core = ensure_core(db, emp)
    if core.rol_id is None:
        core.rol_id = rol_id
    if not core.password_hash:
        core.password_hash = hash_password(user_data["password"])
    if not core.email:
        core.email = user_data["email"]
    await db.flush()

    logger.info("  %s asegurado (empleado_id=%d, email=%s)", label, emp.empleado_id, core.email)


async def seed_rh_permisos_admins(db) -> None:
    """Marca `puede_administrar_permisos_rh=true` en los empleados de
    SEED_RH_PERMISOS_ADMIN_EMPLEADO_IDS (.env). Idempotente."""
    from app.models.empleados_rh import ensure_rh_permisos

    empleado_ids = settings.SEED_RH_PERMISOS_ADMIN_EMPLEADO_IDS
    if not empleado_ids:
        logger.info(
            "  Sin SEED_RH_PERMISOS_ADMIN_EMPLEADO_IDS — omitiendo administradores de permisos RH"
        )
        return

    for empleado_id in empleado_ids:
        result = await db.execute(
            select(Empleado).where(Empleado.empleado_id == empleado_id)
        )
        emp = result.scalar_one_or_none()
        if emp is None:
            if settings.APP_ENV == "production":
                raise RuntimeError(
                    f"No existe empleado_id={empleado_id} en Bono.empleados. "
                    "Configure SEED_RH_PERMISOS_ADMIN_EMPLEADO_IDS con empleados activos existentes."
                )
            logger.warning(
                "  empleado_id=%d no encontrado — omitiendo admin permisos RH", empleado_id
            )
            continue

        permisos = ensure_rh_permisos(db, emp)
        permisos.puede_administrar_permisos_rh = True
        await db.flush()
        logger.info(
            "  Admin permisos RH: empleado_id=%d (%s)", emp.empleado_id, emp.nombre
        )


async def seed_level_up(db) -> None:
    """Crea datos seed para el módulo Level Up. Idempotente por nombre."""
    capacidades = [
        {"nombre": "Programación CNC", "categoria": CategoriaCapacidad.tecnica},
        {"nombre": "Operación de Inyectora", "categoria": CategoriaCapacidad.operativa},
        {"nombre": "Manejo LOTO", "categoria": CategoriaCapacidad.seguridad},
        {"nombre": "Control SPC", "categoria": CategoriaCapacidad.calidad},
        {"nombre": "Soldadura por puntos", "categoria": CategoriaCapacidad.tecnica},
    ]
    for data in capacidades:
        result = await db.execute(
            select(Capacidad).where(Capacidad.nombre == data["nombre"])
        )
        if not result.scalar_one_or_none():
            db.add(Capacidad(**data))
            logger.info("  Capacidad '%s' creada", data["nombre"])
    await db.flush()

    habilidades = [
        {"nombre": "Comunicación Efectiva", "tipo": TipoHabilidad.blanda},
        {"nombre": "Lectura de Planos", "tipo": TipoHabilidad.tecnica},
        {"nombre": "5S", "tipo": TipoHabilidad.operativa},
        {"nombre": "Respuesta a Emergencias", "tipo": TipoHabilidad.critica},
    ]
    for data in habilidades:
        result = await db.execute(
            select(Habilidad).where(Habilidad.nombre == data["nombre"])
        )
        if not result.scalar_one_or_none():
            db.add(Habilidad(**data))
            logger.info("  Habilidad '%s' creada", data["nombre"])
    await db.flush()

    cursos = [
        {
            "nombre": "CNC Básico",
            "duracion_horas": 40,
            "modalidad": "presencial",
            "sesiones_anio": 4,
        },
        {
            "nombre": "ISO 9001:2015 Auditor Interno",
            "duracion_horas": 24,
            "modalidad": "mixta",
            "sesiones_anio": 2,
        },
        {
            "nombre": "LOTO y Seguridad Eléctrica",
            "duracion_horas": 8,
            "modalidad": "presencial",
            "sesiones_anio": 12,
        },
    ]
    for data in cursos:
        result = await db.execute(
            select(Curso).where(Curso.nombre == data["nombre"])
        )
        if not result.scalar_one_or_none():
            db.add(Curso(**data))
            logger.info("  Curso '%s' creado", data["nombre"])
    await db.flush()

    logger.info("Level Up seed completado")


async def seed() -> None:
    """Punto de entrada principal del seed. Idempotente."""
    logger.info("=== Iniciando seed — Plataforma RH Leoni Cable ===")

    async with AsyncSessionLocal() as db:
        try:
            if settings.APP_ENV == "production":
                logger.info(
                    "Seeding catálogos omitido (producción: tablas Bono son solo lectura)"
                )
            else:
                logger.info("Seeding catálogos...")
                await seed_catalogos(db)

            logger.info("Seeding roles...")
            created_roles = await seed_roles(db)

            logger.info("Seeding usuarios...")
            rol_rh_id = created_roles.get("rh")
            if not rol_rh_id:
                raise RuntimeError("El rol 'rh' no fue creado correctamente")

            admin_data = dict(ADMIN_RH)
            if settings.SEED_ADMIN_EMPLEADO_ID is not None:
                admin_data["empleado_id"] = settings.SEED_ADMIN_EMPLEADO_ID
            await seed_user(db, admin_data, rol_rh_id, "Admin RH")

            if settings.APP_ENV != "production":
                await seed_user(db, DEV_USER, rol_rh_id, "Dev User")

            logger.info("Seeding administradores de permisos RH...")
            await seed_rh_permisos_admins(db)

            if settings.APP_ENV == "production":
                logger.info("Seeding Level Up omitido (producción)")
            else:
                logger.info("Seeding Level Up...")
                await seed_level_up(db)

            await db.commit()
            logger.info("=== Seed completado exitosamente ===")

        except Exception:
            await db.rollback()
            logger.exception("Error durante el seed — rollback ejecutado")
            raise


if __name__ == "__main__":
    asyncio.run(seed())
