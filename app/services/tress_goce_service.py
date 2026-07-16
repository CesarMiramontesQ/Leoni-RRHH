"""
Registro de permiso con goce (FJ) en TRESS (SQL Server datos-analisis).

Se invoca de forma sincrona al crear matrimonio / defuncion / paternidad en
faltas/retardos. Un tramo de fechas = un INSERT en dbo.PERMISO.
"""

from __future__ import annotations

import logging
from datetime import date

from app.core.config import settings
from app.core.exceptions import ConflictError, DomainValidationError, ServiceUnavailableError
from app.integrations.datos_analisis_db import DatosAnalisisWriteClient
from app.repositories.datos_analisis_permiso_goce_write_repository import (
    DatosAnalisisPermisoGoceWriteRepository,
    InsertarPermisoGoceResult,
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

# Comentario fijo PM_COMENTA por tipo de falta/retardo (max 30 chars TRESS).
GOCE_PM_COMENTA: dict[str, str] = {
    "matrimonio": "MATRIMONIO",
    "defuncion": "FALLECIMIENTO",
    "paternidad": "PATERNIDAD",
}

# Tipos que se escriben en dbo.PERMISO como FJ con split semanal.
FALTA_RETARDO_TIPOS_GOCE_FJ = frozenset(GOCE_PM_COMENTA.keys())


def _map_fallo_tress(result: InsertarPermisoGoceResult) -> None:
    codigo = (result.codigo_error or "").upper()
    detalle = result.mensaje or "No se pudo registrar el permiso con goce en TRESS."
    if codigo in _CODIGOS_CONFLICTO:
        raise ConflictError(detail=detalle)
    if codigo in _CODIGOS_VALIDACION:
        raise DomainValidationError(detail=detalle)
    raise ServiceUnavailableError(detail=detalle)


async def registrar_permiso_goce_en_tress(
    *,
    no_empleado: int,
    fecha_inicio: date,
    fecha_fin: date,
    comentario: str,
) -> InsertarPermisoGoceResult:
    """
    Inserta un tramo de permiso con goce en dbo.PERMISO (PM_TIPO='FJ ').

    Raises:
        ServiceUnavailableError: sin conexion o error SQL/infra.
        ConflictError / DomainValidationError: reglas de negocio TRESS.
    """
    if no_empleado <= 0:
        raise DomainValidationError(detail="Numero de empleado invalido para TRESS.")
    if fecha_fin < fecha_inicio:
        raise DomainValidationError(detail="La fecha fin no puede ser anterior a la fecha inicio.")
    motivo = (comentario or "").strip()
    if not motivo:
        raise DomainValidationError(detail="El comentario TRESS es obligatorio para permiso con goce.")
    if len(motivo) > 30:
        raise DomainValidationError(detail="El comentario TRESS no puede exceder 30 caracteres.")

    confirmar = not bool(settings.TRESS_GOCE_DRY_RUN)
    engine = DatosAnalisisWriteClient.create_write_engine()
    if engine is None:
        raise ServiceUnavailableError(
            detail=(
                "No se pudo conectar a TRESS (datos-analisis): "
                "configura DATOS_ANALISIS_DB_HOST/NAME/USER."
            )
        )

    try:
        repo = DatosAnalisisPermisoGoceWriteRepository(engine)
        result = await repo.insertar_permiso_goce(
            empleado=no_empleado,
            usuario=str(settings.TRESS_VACACIONES_US_CODIGO),
            fecha_inicio=fecha_inicio,
            fecha_fin_mostrar=fecha_fin,
            comentario=motivo,
            confirmar=confirmar,
        )
    except (ConflictError, DomainValidationError, ServiceUnavailableError):
        raise
    except Exception as exc:
        logger.exception(
            "Error al registrar permiso goce en TRESS (empleado=%s, %s..%s)",
            no_empleado,
            fecha_inicio,
            fecha_fin,
        )
        raise ServiceUnavailableError(
            detail=f"Error al registrar permiso con goce en TRESS: {type(exc).__name__}: {exc}"
        ) from exc
    finally:
        await engine.dispose()

    if settings.TRESS_GOCE_DRY_RUN:
        if not result.ok:
            _map_fallo_tress(result)
        logger.warning(
            "TRESS_GOCE_DRY_RUN activo: permiso goce validado sin COMMIT "
            "(empleado=%s, %s..%s)",
            no_empleado,
            fecha_inicio,
            fecha_fin,
        )
        raise ConflictError(
            detail=(
                "Modo dry-run de TRESS activo: el permiso con goce se validó pero no se "
                "persistió. Desactiva TRESS_GOCE_DRY_RUN para registrar."
            )
        )

    if not result.ok:
        _map_fallo_tress(result)

    logger.info(
        "Permiso goce registrado en TRESS llave=%s empleado=%s %s..%s comenta=%s",
        result.nueva_llave,
        no_empleado,
        fecha_inicio,
        fecha_fin,
        motivo,
    )
    return result


async def registrar_permisos_goce_tramos_en_tress(
    *,
    no_empleado: int,
    tramos: list[tuple[date, date]],
    comentario: str,
) -> list[InsertarPermisoGoceResult]:
    """Inserta un dbo.PERMISO por cada tramo (semana). Fallo en uno aborta el resto."""
    resultados: list[InsertarPermisoGoceResult] = []
    for inicio, fin in tramos:
        resultados.append(
            await registrar_permiso_goce_en_tress(
                no_empleado=no_empleado,
                fecha_inicio=inicio,
                fecha_fin=fin,
                comentario=comentario,
            )
        )
    return resultados
