"""Consulta enfocada de descansos aplicados en TRESS."""

from __future__ import annotations

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    DomainValidationError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.repositories.datos_analisis_descansos_repository import (
    DatosAnalisisDescansosRepository,
)
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.empleados import DescansosEmpleadoResponse

MAX_DIAS_RANGO_DESCANSOS = 366


def validar_rango_descansos(*, fecha_inicio: date, fecha_fin: date) -> None:
    if fecha_fin < fecha_inicio:
        raise DomainValidationError(
            detail="fecha_inicio no puede ser posterior a fecha_fin",
            field="fecha_fin",
        )
    dias = (fecha_fin - fecha_inicio).days + 1
    if dias > MAX_DIAS_RANGO_DESCANSOS:
        raise DomainValidationError(
            detail=f"El rango no puede exceder {MAX_DIAS_RANGO_DESCANSOS} días",
            field="fecha_fin",
        )


async def obtener_descansos_tress(
    *,
    cb_codigo: int,
    fecha_inicio: date,
    fecha_fin: date,
) -> list[date]:
    """
    Obtiene descansos TRESS (proyección Kardex+TURNO + override AUSENCIA).

    Falla cerrado si DATOS_ANALISIS no responde. El contrato sigue siendo lista de fechas.
    """
    validar_rango_descansos(fecha_inicio=fecha_inicio, fecha_fin=fecha_fin)
    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:  # noqa: BLE001 - driver/configuración de integración
        raise ServiceUnavailableError("No se pudieron consultar los descansos.") from exc
    if engine is None:
        raise ServiceUnavailableError(
            "No se pudieron consultar los descansos (datos-analisis no configurada)."
        )
    try:
        fechas = await DatosAnalisisDescansosRepository(engine).list_descansos(
            cb_codigo=cb_codigo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )
    except Exception as exc:  # noqa: BLE001 - errores ODBC/SQL de la integración
        raise ServiceUnavailableError("No se pudieron consultar los descansos.") from exc
    finally:
        await engine.dispose()
    return sorted(set(fechas))


class DescansosEmpleadoService:
    def __init__(self, db: AsyncSession) -> None:
        self.empleado_repo = EmpleadoRepository(db)

    async def obtener_descansos(
        self,
        *,
        empleado_id: int,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> DescansosEmpleadoResponse:
        validar_rango_descansos(fecha_inicio=fecha_inicio, fecha_fin=fecha_fin)
        empleado = await self.empleado_repo.get_by_empleado_id(empleado_id)
        if empleado is None:
            raise NotFoundError(entidad="Empleado", id=empleado_id)

        descansos = await obtener_descansos_tress(
            cb_codigo=empleado.no_empleado,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )
        return DescansosEmpleadoResponse(
            empleado_id=empleado_id,
            no_empleado=empleado.no_empleado,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            descansos=sorted(set(descansos)),
        )
