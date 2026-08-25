"""
Registro de home office aprobado en TRESS (SQL Server datos-analisis).

Se invoca de forma sincrono antes de marcar la solicitud como approved.
"""

from __future__ import annotations

import logging
from datetime import date

from app.core.config import settings
from app.core.exceptions import ConflictError, DomainValidationError, ServiceUnavailableError
from app.integrations.datos_analisis_db import DatosAnalisisWriteClient
from app.repositories.datos_analisis_home_office_write_repository import (
    DatosAnalisisHomeOfficeWriteRepository,
    InsertarHomeOfficeResult,
)

logger = logging.getLogger(__name__)

_CODIGOS_CONFLICTO = frozenset({
    "TRASLAPE_PERMISO",
    "TRASLAPE_VACACION",
    "TRASLAPE_INCAPACIDAD",
})
_CODIGOS_VALIDACION = frozenset({
    "EMPLEADO_NO_ENCONTRADO",
    "FECHA_INVALIDA",
})


def _map_fallo_tress(result: InsertarHomeOfficeResult) -> None:
    codigo = (result.codigo_error or "").upper()
    detalle = result.mensaje or "No se pudo registrar el home office en TRESS."
    if codigo in _CODIGOS_CONFLICTO:
        raise ConflictError(detail=detalle)
    if codigo in _CODIGOS_VALIDACION:
        raise DomainValidationError(detail=detalle)
    raise ServiceUnavailableError(detail=detalle)


async def registrar_home_office_en_tress(
    *,
    no_empleado: int,
    fecha_inicio: date,
    fecha_fin: date,
) -> InsertarHomeOfficeResult:
    """
    Inserta home office en dbo.PERMISO.

    Raises:
        ServiceUnavailableError: sin conexion o error SQL/infra.
        ConflictError / DomainValidationError: reglas de negocio TRESS.
    """
    if no_empleado <= 0:
        raise DomainValidationError(detail="Numero de empleado invalido para TRESS.")
    if fecha_fin < fecha_inicio:
        raise DomainValidationError(detail="La fecha fin no puede ser anterior a la fecha inicio.")

    if settings.TRESS_ESCRITURA_BLOQUEADA:
        logger.warning(
            "TRESS_ESCRITURA_BLOQUEADA activo: home office omitido en TRESS "
            "(empleado=%s, %s..%s)",
            no_empleado,
            fecha_inicio,
            fecha_fin,
        )
        return InsertarHomeOfficeResult(
            ok=True,
            codigo_error=None,
            mensaje=(
                "Escritura a TRESS bloqueada (TRESS_ESCRITURA_BLOQUEADA). "
                "No se persistió en nómina."
            ),
            nueva_llave=None,
        )

    confirmar = not bool(settings.TRESS_HOME_OFFICE_DRY_RUN)
    engine = DatosAnalisisWriteClient.create_write_engine()
    if engine is None:
        raise ServiceUnavailableError(
            detail=(
                "No se pudo conectar a TRESS (datos-analisis): "
                "configura DATOS_ANALISIS_DB_HOST/NAME/USER."
            )
        )

    try:
        repo = DatosAnalisisHomeOfficeWriteRepository(engine)
        result = await repo.insertar_home_office(
            empleado=no_empleado,
            usuario=str(settings.TRESS_VACACIONES_US_CODIGO),
            fecha_inicio=fecha_inicio,
            fecha_fin_mostrar=fecha_fin,
            confirmar=confirmar,
        )
    except (ConflictError, DomainValidationError, ServiceUnavailableError):
        raise
    except Exception as exc:
        logger.exception(
            "Error al registrar home office en TRESS (empleado=%s, %s..%s)",
            no_empleado,
            fecha_inicio,
            fecha_fin,
        )
        raise ServiceUnavailableError(
            detail=f"Error al registrar home office en TRESS: {type(exc).__name__}: {exc}"
        ) from exc
    finally:
        await engine.dispose()

    if settings.TRESS_HOME_OFFICE_DRY_RUN:
        if not result.ok:
            _map_fallo_tress(result)
        logger.warning(
            "TRESS_HOME_OFFICE_DRY_RUN activo: home office validado sin COMMIT "
            "(empleado=%s, %s..%s)",
            no_empleado,
            fecha_inicio,
            fecha_fin,
        )
        raise ConflictError(
            detail=(
                "Modo dry-run de TRESS activo: el home office se valido pero no se "
                "persistio. Desactiva TRESS_HOME_OFFICE_DRY_RUN para aprobar."
            )
        )

    if not result.ok:
        _map_fallo_tress(result)

    logger.info(
        "Home office registrado en TRESS llave=%s empleado=%s %s..%s",
        result.nueva_llave,
        no_empleado,
        fecha_inicio,
        fecha_fin,
    )
    return result
