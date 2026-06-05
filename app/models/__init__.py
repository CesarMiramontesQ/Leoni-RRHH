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
from app.models.vacaciones import Vacaciones
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
from app.models.bono_historico_import_log import BonoHistoricoImportLog
from app.models.tress import TressRobotQueue
from app.models.talento import (
    PuestoPerfil, Competencia, CompetenciaRequisito, EvaluacionCompetencia,
    Capacitacion, Inscripcion,
    TareaCatalogo, PerfilTarea, PerfilCualificacion,
    PerfilFunciones, PerfilFuncionesCualificacion, PerfilFuncionesCompetencia,
    PerfilFuncionesTarea, NivelPuesto, TipoCompetencia, GrupoCompetencia,
    TipoCualificacionCatalogo, MetodoCalificacion, OpcionCalificacion, CualificacionCatalogo,
)
from app.models.level_up import (
    Capacidad,
    CapacidadPuestoPerfil,
    Habilidad,
    EvaluacionCapacidad,
    EvaluacionHabilidad,
    Curso,
    CursoSesion,
    CursoEmpleado,
    CursoPuesto,
    OPL,
    OPLVersion,
    EvidenciaCapacitacion,
    EvidenciaFirma,
    EncuestaPostCurso,
    SugerenciaCapacitacion,
    PlanDesarrollo,
    PlanEtapa,
)

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
    "Vacaciones",
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
    "BonoHistoricoImportLog",
    "TressRobotQueue",
    "PuestoPerfil",
    "Competencia",
    "CompetenciaRequisito",
    "EvaluacionCompetencia",
    "Capacitacion",
    "Inscripcion",
    "PerfilTarea",
    "PerfilCualificacion",
    "PerfilFunciones",
    "PerfilFuncionesCualificacion",
    "PerfilFuncionesCompetencia",
    "PerfilFuncionesTarea",
    "TipoCualificacionCatalogo",
    "MetodoCalificacion",
    "OpcionCalificacion",
    "CualificacionCatalogo",
    "Capacidad",
    "CapacidadPuestoPerfil",
    "Habilidad",
    "EvaluacionCapacidad",
    "EvaluacionHabilidad",
    "Curso",
    "CursoSesion",
    "CursoEmpleado",
    "CursoPuesto",
    "OPL",
    "OPLVersion",
    "EvidenciaCapacitacion",
    "EvidenciaFirma",
    "EncuestaPostCurso",
    "SugerenciaCapacitacion",
    "PlanDesarrollo",
    "PlanEtapa",
]
