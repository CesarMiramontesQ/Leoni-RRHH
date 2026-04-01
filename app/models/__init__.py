# CRITICAL: All models must be imported here so Alembic autogenerate detects them.
from app.models.roles import Rol
from app.models.empleados import Empleado
from app.models.solicitudes import Solicitud, SolicitudAprobacion
from app.models.incidencias import Incidencia, Evidencia
from app.models.actas import ActaAdministrativa, ActaAprobacion
from app.models.comedor import Comedor, MenuSemanal, ComedorRegistro
from app.models.notificaciones import Notificacion
from app.models.auditoria import AuditLog, ItSyncLog, TokenBlacklist
from app.models.tress import TressRobotQueue

__all__ = [
    "Rol",
    "Empleado",
    "Solicitud",
    "SolicitudAprobacion",
    "Incidencia",
    "Evidencia",
    "ActaAdministrativa",
    "ActaAprobacion",
    "Comedor",
    "MenuSemanal",
    "ComedorRegistro",
    "Notificacion",
    "AuditLog",
    "ItSyncLog",
    "TokenBlacklist",
    "TressRobotQueue",
]
