# CRITICAL: All models must be imported here so Alembic autogenerate detects them.
from app.models.roles import Rol
from app.models.catalogos import (
    Area,
    Categoria,
    ClasificacionEmpleado,
    EstadoEmpleado,
    Puesto,
    Subarea,
)
from app.models.empleados import Empleado
from app.models.turnos_empleados import TurnoEmpleado
from app.models.solicitudes import Solicitud, SolicitudAprobacion
from app.models.incidencias import Incidencia, Evidencia
from app.models.actas import ActaAdministrativa, ActaAprobacion
from app.models.comedor import (
    Comedor,
    ComedorAcceso,
    ComedorCodigoExterno,
    ComedorExternoCorrelativo,
    ComedorRegistro,
    MenuSemanal,
)
from app.models.notificaciones import Notificacion
from app.models.emails import Email
from app.models.auditoria import AuditLog, ItSyncLog, TokenBlacklist
from app.models.tress import TressRobotQueue
from app.models.talento import PuestoPerfil, Competencia, CompetenciaRequisito

__all__ = [
    "Rol",
    "Area",
    "Subarea",
    "Categoria",
    "Puesto",
    "EstadoEmpleado",
    "ClasificacionEmpleado",
    "Empleado",
    "TurnoEmpleado",
    "Solicitud",
    "SolicitudAprobacion",
    "Incidencia",
    "Evidencia",
    "ActaAdministrativa",
    "ActaAprobacion",
    "Comedor",
    "ComedorAcceso",
    "ComedorCodigoExterno",
    "ComedorExternoCorrelativo",
    "MenuSemanal",
    "ComedorRegistro",
    "Notificacion",
    "Email",
    "AuditLog",
    "ItSyncLog",
    "TokenBlacklist",
    "TressRobotQueue",
    "PuestoPerfil",
    "Competencia",
    "CompetenciaRequisito",
]
