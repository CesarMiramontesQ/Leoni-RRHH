"""Comparación entre `empleados.no_empleado` (int) y `turnos_empleados.no_empleado` (varchar)."""

from __future__ import annotations

from sqlalchemy import ColumnElement, String, cast, func, or_

from app.models.empleados import Empleado
from app.models.turnos_empleados import TurnoEmpleado


def no_empleado_as_turno_str(no_empleado: int) -> str:
    return str(int(no_empleado))


def turno_no_empleado_matches(no_empleado: int) -> ColumnElement[bool]:
    """Condición WHERE para localizar turno por número de empleado."""
    base = no_empleado_as_turno_str(no_empleado)
    return or_(
        TurnoEmpleado.no_empleado == base,
        TurnoEmpleado.no_empleado == f"{base}.0",
    )


def turno_empleado_join_on() -> ColumnElement[bool]:
    """Condición JOIN entre Empleado y TurnoEmpleado."""
    no_str = cast(Empleado.no_empleado, String)
    return or_(
        TurnoEmpleado.no_empleado == no_str,
        TurnoEmpleado.no_empleado == func.concat(no_str, ".0"),
    )
