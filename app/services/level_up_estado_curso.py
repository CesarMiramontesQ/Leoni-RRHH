"""Estado derivado curso-empleado para el dashboard de seguimiento."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

EstadoCursoEmpleado = Literal[
    "pendiente", "programado", "completado", "no_acreditado", "en_progreso"
]


@dataclass(frozen=True)
class InscripcionEstadoInput:
    sesion_estado: str
    asistio: bool | None
    fecha_inscripcion: date | None = None
    fecha_sesion_fin: date | None = None
    fecha_sesion_inicio: date | None = None


def compute_estado_curso_empleado(
    asignado: bool,
    inscripciones: list[InscripcionEstadoInput],
) -> EstadoCursoEmpleado | None:
    """Calcula estado curso-empleado. Retorna None si no está asignado ni inscrito."""
    if not asignado and not inscripciones:
        return None

    if any(i.asistio is True for i in inscripciones):
        return "completado"
    if any(i.sesion_estado == "en_curso" for i in inscripciones):
        return "en_progreso"
    if any(i.sesion_estado == "programada" for i in inscripciones):
        return "programado"
    if any(i.sesion_estado == "completada" and i.asistio is False for i in inscripciones):
        return "no_acreditado"
    if asignado:
        return "pendiente"
    return "pendiente"


def fecha_finalizacion_curso(
    inscripciones: list[InscripcionEstadoInput],
) -> date | None:
    for i in inscripciones:
        if i.asistio is True:
            if i.fecha_inscripcion:
                return i.fecha_inscripcion
            if i.fecha_sesion_fin:
                return i.fecha_sesion_fin
            if i.fecha_sesion_inicio:
                return i.fecha_sesion_inicio
    return None
