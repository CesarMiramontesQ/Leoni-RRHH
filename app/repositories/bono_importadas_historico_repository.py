"""Escritura y lectura puntual en bono_productividad.importadas_historico."""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_FETCH_SQL_FILE = (
    Path(__file__).resolve().parent / "sql" / "bono_importadas_historico_fetch.sql"
)


class BonoImportadasHistoricoRepository:
    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine
        self._fetch_sql = _FETCH_SQL_FILE.read_text(encoding="utf-8")

    async def resolve_semana_id(self, fecha: date) -> int | None:
        sql = """
            SELECT id
            FROM semana_historico
            WHERE fecha_ini <= :fecha AND fecha_fin >= :fecha
            ORDER BY id DESC
            LIMIT 1
        """
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), {"fecha": fecha})
            row = result.scalar()
            return int(row) if row is not None else None

    async def list_semana_ids_en_rango(
        self, fecha_inicio: date, fecha_fin: date
    ) -> list[int]:
        sql = """
            SELECT id
            FROM semana_historico
            WHERE fecha_fin >= :fecha_inicio AND fecha_ini <= :fecha_fin
            ORDER BY fecha_ini ASC, id ASC
        """
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(sql),
                {"fecha_inicio": fecha_inicio, "fecha_fin": fecha_fin},
            )
            return [int(row[0]) for row in result.fetchall()]

    async def insert_evento(
        self,
        *,
        no_empleado: int,
        tipo_inc: str,
        inc_id: int,
        id_semana: int,
        area_empleado: int | None,
        subarea_empleado: int | None,
        fecha_incidencia: date | None,
        fecha_registro: datetime | None = None,
    ) -> int:
        sql = """
            INSERT INTO importadas_historico (
                no_empleado,
                tipo_inc,
                inc_id,
                id_semana,
                area_empleado,
                subarea_empleado,
                fecha_incidencia,
                fecha_registro
            )
            VALUES (
                :no_empleado,
                :tipo_inc,
                :inc_id,
                :id_semana,
                :area_empleado,
                :subarea_empleado,
                :fecha_incidencia,
                COALESCE(:fecha_registro, NOW())
            )
            RETURNING id
        """
        async with self._engine.begin() as conn:
            result = await conn.execute(
                text(sql),
                {
                    "no_empleado": no_empleado,
                    "tipo_inc": tipo_inc,
                    "inc_id": inc_id,
                    "id_semana": id_semana,
                    "area_empleado": area_empleado,
                    "subarea_empleado": subarea_empleado,
                    "fecha_incidencia": fecha_incidencia,
                    "fecha_registro": fecha_registro,
                },
            )
            new_id = result.scalar()
            if new_id is None:
                raise RuntimeError("INSERT en importadas_historico no devolvió id")
            return int(new_id)

    async def fetch_evento_row(self, origen_id: int) -> dict[str, Any] | None:
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(self._fetch_sql), {"origen_id": origen_id}
            )
            row = result.mappings().first()
            return dict(row) if row else None
