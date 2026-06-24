"""Admin sintético SOLO para desarrollo.

Permite iniciar sesión como ``admin.rh@leoni.com`` sin depender de un empleado
real de Bono ni escribir en la BD. Construye en memoria un ``Empleado`` con rol
``rh`` y permiso de administración de permisos. Gateado por ``APP_ENV=development``.

NUNCA se activa fuera de development.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import settings
from app.models.empleados import Empleado
from app.models.empleados_rh import EmpleadoCore, EmpleadoRhConfig, EmpleadoRhPermisos
from app.models.roles import Rol

# empleado_id sentinela, improbable en Bono.
DEV_ADMIN_EMPLEADO_ID = 9_999_999
DEV_ADMIN_SUB = str(DEV_ADMIN_EMPLEADO_ID)
# Hash placeholder NO verificable (el login dev compara la contraseña en texto).
# Evita correr bcrypt en cada request (get_current_user reconstruye el admin).
_DEV_ADMIN_PASSWORD_HASH = "!dev-admin-no-login-via-hash"


def dev_login_enabled() -> bool:
    return settings.APP_ENV == "development" and bool(settings.DEV_ADMIN_EMAIL)


def is_dev_admin_credentials(identifier: str, password: str) -> bool:
    if not dev_login_enabled():
        return False
    ident = (identifier or "").strip().lower()
    if ident != settings.DEV_ADMIN_EMAIL.strip().lower():
        return False
    expected = settings.DEV_ADMIN_PASSWORD or ""
    # Comparación directa (texto) para dev; sin almacenar hash.
    return password == expected


def is_dev_admin_sub(sub: str | None) -> bool:
    return dev_login_enabled() and str(sub) == DEV_ADMIN_SUB


def build_dev_admin() -> Empleado:
    """Empleado RH-admin sintético (transitorio, no en sesión)."""
    emp = Empleado(
        empleado_id=DEV_ADMIN_EMPLEADO_ID,
        no_empleado=DEV_ADMIN_EMPLEADO_ID,
        nombre="Admin RH (dev)",
        usuario="admin.rh",
        estado_id=(settings.ESTADOS_ACTIVOS_IDS[0] if settings.ESTADOS_ACTIVOS_IDS else 1),
    )
    rol = Rol(id=0, nombre="rh", permisos={})
    now = datetime.now(timezone.utc)
    emp.core = EmpleadoCore(
        empleado_id=DEV_ADMIN_EMPLEADO_ID,
        rol_id=0,
        email=settings.DEV_ADMIN_EMAIL,
        password_hash=_DEV_ADMIN_PASSWORD_HASH,
        created_at=now,
        updated_at=now,
    )
    emp.core.rol = rol
    emp.rh_permisos = EmpleadoRhPermisos(
        empleado_id=DEV_ADMIN_EMPLEADO_ID,
        puede_administrar_permisos_rh=True,
        puede_registrar_horas_extra=False,
    )
    emp.rh_config = EmpleadoRhConfig(
        empleado_id=DEV_ADMIN_EMPLEADO_ID,
        modulos_rh={},  # vacío = acceso completo para rol rh
        inscrito_modulos_rh=True,
        acceso_rh_removido=False,
    )
    emp.rh_horas_extra = None
    return emp
