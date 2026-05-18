"""Servicio de lectura de incidencias consolidadas (bono_productividad)."""

from __future__ import annotations

from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.core.exceptions import DomainValidationError, ServiceUnavailableError
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.repositories.bono_productividad_incidencias_repository import (
    BonoProductividadIncidenciasRepository,
)
from app.schemas.bono_productividad import (
    BonoIncidenciaConsolidadaItem,
    BonoIncidenciasListaResponse,
    json_safe_item,
)

_TIPOS_VALIDOS = frozenset(
    {
        "calidad",
        "calidad_historico",
        "seguridad",
        "seguridad_historico",
        "progresivo",
        "progresivo_historico",
    }
)


class BonoProductividadIncidenciasService:
    async def listar_incidencias(
        self,
        *,
        empleado_id: int | None,
        no_empleado: str | None,
        tipo: str | None,
        semana_id: int | None,
    ) -> BonoIncidenciasListaResponse:
        if tipo is not None and tipo not in _TIPOS_VALIDOS:
            raise DomainValidationError(
                f"tipo inválido: {tipo!r}. Valores permitidos: {', '.join(sorted(_TIPOS_VALIDOS))}."
            )

        engine = BonoProductividadReadClient.create_read_engine()
        if engine is None:
            raise ServiceUnavailableError(
                "Base bono_productividad no configurada (variables BONO_DB_*)."
            )
        try:
            repo = BonoProductividadIncidenciasRepository(engine)
            rows = await repo.list_incidencias_consolidadas(
                empleado_id=empleado_id,
                no_empleado=no_empleado,
                tipo=tipo,
                semana_id=semana_id,
            )
            items = [
                BonoIncidenciaConsolidadaItem.model_validate(json_safe_item(r)) for r in rows
            ]
            return BonoIncidenciasListaResponse(items=items)
        except SQLAlchemyError as exc:
            raise ServiceUnavailableError(
                f"Error al consultar bono_productividad: {type(exc).__name__}: {exc}"
            ) from exc
        except ValidationError as exc:
            raise ServiceUnavailableError(
                f"Fila incompatible con el esquema de respuesta: {exc}"
            ) from exc
        except Exception as exc:
            raise ServiceUnavailableError(
                f"Error bono_productividad: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await engine.dispose()
