"""Sincronización manual de incidencias desde bono_productividad hacia BD principal."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ServiceUnavailableError
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.models.empleados import Empleado
from app.models.incidencias import ORIGEN_INCIDENCIA_BONO, Incidencia
from app.repositories.bono_productividad_incidencias_repository import (
    BonoProductividadIncidenciasRepository,
)
from app.schemas.bono_productividad import BonoIncidenciasSyncResponse, BonoSyncErrorItem

logger = logging.getLogger(__name__)

_MAX_ERRORS = 100

# No se importan a incidencias locales (solo lectura API de lista sigue mostrándolas).
_TIPOS_EXCLUIDOS_SYNC_BONO = frozenset(
    {
        "progresivo",
        "progresivo_historico",
        "progesivo",  # variante con typo que a veces aparece en origen
    }
)


class BonoProductividadSyncService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _safe_int(value) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _safe_float(value) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _safe_date(value) -> date | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            value = value.date()
        if isinstance(value, date):
            if 1900 <= value.year <= 2100:
                return value
            return None
        if isinstance(value, str):
            s = value.strip()
            if not s:
                return None
            base = s.replace("Z", "").split("+", 1)[0].split("T", 1)[0].strip()[:10]
            parts = base.split("-")
            if len(parts) != 3:
                return None
            try:
                y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                if not (1900 <= y <= 2100):
                    return None
                return date(y, m, d)
            except (TypeError, ValueError):
                return None
        return None

    @staticmethod
    def _apply_fields(inc: Incidencia, row: dict) -> None:
        inc.no_empleado = str(row.get("no_empleado") or "").strip() or None
        inc.nombre = str(row.get("nombre") or "").strip() or None
        inc.fecha = BonoProductividadSyncService._safe_date(row.get("fecha"))
        inc.categoria = str(row.get("categoria") or "").strip() or None
        inc.detalle = str(row.get("detalle") or "").strip() or None
        inc.area = str(row.get("area") or "").strip() or None
        inc.subarea = str(row.get("subarea") or "").strip() or None
        inc.origen = ORIGEN_INCIDENCIA_BONO
        inc.synced_at = datetime.now(timezone.utc)

    async def _find_existing(
        self,
        *,
        empleado_id: int,
        tipo: str,
        fecha: date | None,
        categoria: str | None,
        detalle: str | None,
        area: str | None,
        subarea: str | None,
    ) -> Incidencia | None:
        result = await self.db.execute(
            select(Incidencia)
            .where(
                and_(
                    Incidencia.origen == ORIGEN_INCIDENCIA_BONO,
                    Incidencia.empleado_id == empleado_id,
                    Incidencia.tipo == tipo,
                    Incidencia.fecha == fecha,
                    Incidencia.categoria == categoria,
                    Incidencia.detalle == detalle,
                    Incidencia.area == area,
                    Incidencia.subarea == subarea,
                )
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _load_empleados_index(
        self, bono_rows: list[dict]
    ) -> tuple[dict[int, int], dict[str, int]]:
        empleado_ids = {
            int(v)
            for v in (r.get("empleado_id") for r in bono_rows)
            if v is not None and str(v).strip() != ""
        }
        no_empleados = {
            str(v).strip().lower()
            for v in (r.get("no_empleado") for r in bono_rows)
            if v is not None and str(v).strip() != ""
        }

        by_empleado_id: dict[int, int] = {}
        by_no_empleado: dict[str, int] = {}

        if empleado_ids:
            result = await self.db.execute(
                select(Empleado.id, Empleado.empleado_id).where(
                    Empleado.empleado_id.in_(empleado_ids)
                )
            )
            for local_id, empleado_id in result.all():
                by_empleado_id[int(empleado_id)] = int(local_id)

        if no_empleados:
            result = await self.db.execute(
                select(Empleado.id, Empleado.no_empleado).where(
                    func.lower(Empleado.no_empleado).in_(no_empleados)
                )
            )
            for local_id, no_emp in result.all():
                by_no_empleado[str(no_emp).strip().lower()] = int(local_id)

        return by_empleado_id, by_no_empleado

    async def sync_incidencias(
        self,
        *,
        dry_run: bool = True,
        limit: int | None = None,
    ) -> BonoIncidenciasSyncResponse:
        bono_engine = BonoProductividadReadClient.create_read_engine()
        if bono_engine is None:
            raise ServiceUnavailableError(
                "Base bono_productividad no configurada (variables BONO_DB_*)."
            )

        errores: list[BonoSyncErrorItem] = []
        try:
            bono_repo = BonoProductividadIncidenciasRepository(bono_engine)
            bono_rows = await bono_repo.list_incidencias_consolidadas(
                empleado_id=None,
                no_empleado=None,
                tipo=None,
                semana_id=None,
            )
        except Exception as exc:  # noqa: BLE001
            raise ServiceUnavailableError(
                f"Error al leer bono_productividad: {type(exc).__name__}: {exc}"
            ) from exc
        finally:
            await bono_engine.dispose()

        total_leidos = len(bono_rows)
        if limit is not None and limit > 0:
            bono_rows = bono_rows[:limit]
        total_considerados = len(bono_rows)

        by_empleado_id, by_no_empleado = await self._load_empleados_index(bono_rows)

        nuevos: list[Incidencia] = []
        actualizados_existentes = 0
        omitidos_dup = 0
        omitidos_sin_empleado = 0
        omitidos_invalidos = 0
        omitidos_tipo_excluido = 0

        for row in bono_rows:
            tipo = str(row.get("tipo") or "otro").strip() or "otro"
            if tipo.lower() in _TIPOS_EXCLUIDOS_SYNC_BONO:
                omitidos_tipo_excluido += 1
                continue

            local_empleado_id: int | None = None
            try:
                bono_emp_id = row.get("empleado_id")
                if bono_emp_id is not None:
                    local_empleado_id = by_empleado_id.get(int(bono_emp_id))
            except Exception:  # noqa: BLE001
                local_empleado_id = None

            if local_empleado_id is None:
                no_emp = str(row.get("no_empleado") or "").strip().lower()
                if no_emp:
                    local_empleado_id = by_no_empleado.get(no_emp)

            if local_empleado_id is None:
                omitidos_sin_empleado += 1
                continue

            fecha = self._safe_date(row.get("fecha"))
            categoria = str(row.get("categoria") or "").strip() or None
            detalle = str(row.get("detalle") or "").strip() or None
            area = str(row.get("area") or "").strip() or None
            subarea = str(row.get("subarea") or "").strip() or None

            existente = await self._find_existing(
                empleado_id=local_empleado_id,
                tipo=tipo,
                fecha=fecha,
                categoria=categoria,
                detalle=detalle,
                area=area,
                subarea=subarea,
            )
            if existente:
                self._apply_fields(existente, row)
                actualizados_existentes += 1
                omitidos_dup += 1
                continue

            incidencia = Incidencia(
                tipo=tipo,
                empleado_id=local_empleado_id,
                fecha=fecha,
                categoria=categoria,
                detalle=detalle,
                area=area,
                subarea=subarea,
                origen=ORIGEN_INCIDENCIA_BONO,
            )
            self._apply_fields(incidencia, row)
            nuevos.append(incidencia)

        inserted = 0
        if not dry_run:
            try:
                async with self.db.begin_nested():
                    if nuevos:
                        self.db.add_all(nuevos)
                    await self.db.flush()
                    inserted = len(nuevos)
            except Exception as exc:  # noqa: BLE001
                raise ServiceUnavailableError(
                    f"Error insertando en incidencias (BD principal): {type(exc).__name__}: {exc}"
                ) from exc

        logger.info(
            "BONO_SYNC | dry_run=%s leidos=%s considerados=%s insertados=%s actualizados=%s "
            "omitidos_duplicado=%s omitidos_sin_empleado=%s omitidos_invalidos=%s "
            "omitidos_tipo_excluido=%s",
            dry_run,
            total_leidos,
            total_considerados,
            inserted,
            actualizados_existentes,
            omitidos_dup,
            omitidos_sin_empleado,
            omitidos_invalidos,
            omitidos_tipo_excluido,
        )

        return BonoIncidenciasSyncResponse(
            dry_run=dry_run,
            total_leidos_bono=total_leidos,
            total_considerados=total_considerados,
            total_insertados=inserted,
            total_actualizados_existentes=actualizados_existentes,
            total_omitidos_duplicado=omitidos_dup,
            total_omitidos_sin_empleado=omitidos_sin_empleado,
            total_omitidos_invalidos=omitidos_invalidos,
            total_omitidos_tipo_excluido=omitidos_tipo_excluido,
            errores=errores,
        )
