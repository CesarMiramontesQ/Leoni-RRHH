"""
Registro de vacaciones aprobadas en TRESS (SQL Server datos-analisis).

Se invoca de forma sincrono antes de marcar la solicitud como approved.
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal

from app.core.config import settings
from app.core.exceptions import ConflictError, DomainValidationError, ServiceUnavailableError
from app.integrations.datos_analisis_db import DatosAnalisisWriteClient
from app.repositories.datos_analisis_vacaciones_write_repository import (
    DatosAnalisisVacacionesWriteRepository,
    InsertarVacacionResult,
)

logger = logging.getLogger(__name__)

_CODIGOS_CONFLICTO = frozenset({
    "TRASLAPE",
    "CONFLICTO_STATUS",
    "CANDADO_NOMINA",
    "SIN_PERIODO",
})
_CODIGOS_VALIDACION = frozenset({
    "SALDO_INSUFICIENTE",
    "SALDO_PRIMA_INSUFICIENTE",
    "EMPLEADO_NO_ENCONTRADO",
})


def _map_fallo_tress(result: InsertarVacacionResult) -> None:
    codigo = (result.codigo_error or "").upper()
    detalle = result.mensaje or "No se pudieron registrar las vacaciones en TRESS."
    if codigo in _CODIGOS_CONFLICTO:
        raise ConflictError(detail=detalle)
    if codigo in _CODIGOS_VALIDACION:
        raise DomainValidationError(detail=detalle)
    raise ServiceUnavailableError(detail=detalle)


async def registrar_vacaciones_en_tress(
    *,
    no_empleado: int,
    fecha_inicio: date,
    fecha_fin: date,
    dias_gozo: int | float | Decimal,
    dias_pago: int | float | Decimal | None = None,
) -> InsertarVacacionResult:
    """
    Inserta vacaciones en dbo.VACACION.

    Raises:
        ServiceUnavailableError: sin conexion o error SQL/infra.
        ConflictError / DomainValidationError: reglas de negocio TRESS.
    """
    if no_empleado <= 0:
        raise DomainValidationError(detail="Numero de empleado invalido para TRESS.")
    if fecha_fin < fecha_inicio:
        raise DomainValidationError(detail="La fecha fin no puede ser anterior a la fecha inicio.")
    gozo = Decimal(str(dias_gozo))
    pago = Decimal(str(dias_pago if dias_pago is not None else dias_gozo))
    if gozo <= 0:
        raise DomainValidationError(detail="Los dias de vacaciones deben ser mayores a cero.")

    if settings.TRESS_ESCRITURA_BLOQUEADA:
        logger.warning(
            "TRESS_ESCRITURA_BLOQUEADA activo: vacaciones omitidas en TRESS "
            "(empleado=%s, %s..%s)",
            no_empleado,
            fecha_inicio,
            fecha_fin,
        )
        return InsertarVacacionResult(
            ok=True,
            codigo_error=None,
            mensaje=(
                "Escritura a TRESS bloqueada (TRESS_ESCRITURA_BLOQUEADA). "
                "No se persistió en nómina."
            ),
            nueva_llave=None,
        )

    confirmar = not bool(settings.TRESS_VACACIONES_DRY_RUN)
    engine = DatosAnalisisWriteClient.create_write_engine()
    if engine is None:
        raise ServiceUnavailableError(
            detail=(
                "No se pudo conectar a TRESS (datos-analisis): "
                "configura DATOS_ANALISIS_DB_HOST/NAME/USER."
            )
        )

    try:
        repo = DatosAnalisisVacacionesWriteRepository(engine)
        result = await repo.insertar_vacacion(
            empleado=no_empleado,
            usuario=str(settings.TRESS_VACACIONES_US_CODIGO),
            fecha_inicio=fecha_inicio,
            fecha_fin_mostrar=fecha_fin,
            nom_tipo=int(settings.TRESS_VACACIONES_NOM_TIPO),
            dias_gozo=gozo,
            dias_pago=pago,
            confirmar=confirmar,
        )
    except (ConflictError, DomainValidationError, ServiceUnavailableError):
        raise
    except Exception as exc:
        logger.exception(
            "Error al registrar vacaciones en TRESS (empleado=%s, %s..%s)",
            no_empleado,
            fecha_inicio,
            fecha_fin,
        )
        raise ServiceUnavailableError(
            detail=f"Error al registrar vacaciones en TRESS: {type(exc).__name__}: {exc}"
        ) from exc
    finally:
        await engine.dispose()

    if settings.TRESS_VACACIONES_DRY_RUN:
        if not result.ok:
            _map_fallo_tress(result)
        logger.warning(
            "TRESS_VACACIONES_DRY_RUN activo: vacaciones validadas sin COMMIT "
            "(empleado=%s, %s..%s)",
            no_empleado,
            fecha_inicio,
            fecha_fin,
        )
        raise ConflictError(
            detail=(
                "Modo dry-run de TRESS activo: las vacaciones se validaron pero no se "
                "persistieron. Desactiva TRESS_VACACIONES_DRY_RUN para aprobar."
            )
        )

    if not result.ok:
        _map_fallo_tress(result)

    logger.info(
        "Vacaciones registradas en TRESS llave=%s empleado=%s %s..%s",
        result.nueva_llave,
        no_empleado,
        fecha_inicio,
        fecha_fin,
    )
    return result
