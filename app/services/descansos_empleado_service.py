"""Consulta enfocada de descansos aplicados en TRESS."""

from __future__ import annotations

from datetime import date, timedelta

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
from app.repositories.turnos_repository import TurnosRepository
from app.schemas.empleados import DescansosEmpleadoResponse
from app.utils.turno_calendario import expandir_patron_rotativo, proyectar_dia
from app.utils.turno_ciclo import ancla_valida, turno_tress_desde_modelo

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


_MSG_SIN_TURNO = (
    "El turno de este empleado aún no se ha sincronizado, así que no se pueden calcular "
    "sus descansos. Se actualiza automáticamente cada día; si persiste, contacta a RH."
)
_MSG_TURNO_SIN_CATALOGO = (
    "El turno {codigo} de este empleado no está en el catálogo sincronizado de nómina, "
    "así que no se pueden calcular sus descansos."
)
_MSG_SIN_ANCLA = (
    "Este turno es rotativo pero no tiene fecha de inicio de ciclo en nómina, así que no "
    "se puede saber qué días descansa."
)
_MSG_PATRON_INVALIDO = (
    "El patrón de rotación de este turno usa un formato que el sistema no interpreta; "
    "revísalo en nómina."
)
_MSG_PROYECCION_IMPOSIBLE = (
    "El calendario de este turno no se pudo calcular para el rango solicitado; revísalo "
    "en nómina."
)


async def obtener_descansos_bono(
    db: AsyncSession,
    *,
    cb_codigo: int,
    fecha_inicio: date,
    fecha_fin: date,
) -> list[date]:
    """Descansos proyectados desde Bono, sin consultar DATOS_ANALISIS.

    Cadena: `empleado → turno vigente → catálogo del turno → jornadas → proyección`. El
    motor de rotación (`app.utils.turno_calendario`) replica `dbo.FN_GeneraRitmo` y ya fue
    validado día a día contra lo que TRESS computó.

    **No se aplica el override de `dbo.AUSENCIA` ni se consulta el kardex**: se proyecta con
    el turno **vigente**. Para fechas anteriores a un cambio de turno la proyección puede
    diferir de lo que nómina aplicó; se acepta porque el uso real es hacia el futuro
    (pedir vacaciones, otorgar goce).

    **Falla cerrado** (`ServiceUnavailableError`) cuando la caché no alcanza para proyectar
    con confianza, en vez de devolver una lista vacía: de esta lista sale el conteo de días
    de una solicitud de vacaciones, y un falso «no descansa» contaría días de más.
    """
    validar_rango_descansos(fecha_inicio=fecha_inicio, fecha_fin=fecha_fin)

    repo = TurnosRepository(db)
    tu_codigo = await repo.get_tu_codigo_de_empleado(cb_codigo)
    if not tu_codigo:
        raise ServiceUnavailableError(_MSG_SIN_TURNO)

    modelo = await repo.get_turno(tu_codigo)
    if modelo is None:
        raise ServiceUnavailableError(_MSG_TURNO_SIN_CATALOGO.format(codigo=tu_codigo))

    turno = turno_tress_desde_modelo(modelo)
    if not ancla_valida(turno):
        raise ServiceUnavailableError(_MSG_SIN_ANCLA)

    if turno.es_rotativo:
        try:
            expandir_patron_rotativo(
                turno.rit_pat or "",
                horario1=turno.hors[0],
                horario2=turno.hors[1],
                horario3=turno.hors[2],
            )
        except ValueError as exc:
            raise ServiceUnavailableError(_MSG_PATRON_INVALIDO) from exc

    horarios = await repo.map_jornadas()
    descansos: list[date] = []
    cursor = fecha_inicio
    while cursor <= fecha_fin:
        try:
            dia = proyectar_dia(turno, cursor, horarios=horarios)
        except ValueError as exc:
            # Fecha anterior a TU_RIT_INI, o rotativo sin ancla que `ancla_valida` no
            # atrapó. No se proyecta a medias: el rango completo se declara no calculable.
            raise ServiceUnavailableError(_MSG_PROYECCION_IMPOSIBLE) from exc
        if dia.estatus == "DESCANSO":
            descansos.append(cursor)
        cursor += timedelta(days=1)
    return descansos


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
