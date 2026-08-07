"""Escritura y lectura puntual en bono_productividad.importadas_historico."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

_FETCH_SQL_FILE = (
    Path(__file__).resolve().parent / "sql" / "bono_importadas_historico_fetch.sql"
)


@dataclass(frozen=True)
class SemanaAnteriorRango:
    id_semana: int
    fecha_inicio: date
    fecha_fin: date


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

    async def resolve_rango_semana_anterior(
        self, hoy: date
    ) -> SemanaAnteriorRango | None:
        """Semana inmediatamente anterior a la que contiene ``hoy`` en semana_historico."""
        sql = """
            WITH actual AS (
                SELECT id, fecha_ini, fecha_fin
                FROM semana_historico
                WHERE fecha_ini <= :hoy AND fecha_fin >= :hoy
                ORDER BY id DESC
                LIMIT 1
            )
            SELECT s.id, s.fecha_ini, s.fecha_fin
            FROM semana_historico s
            CROSS JOIN actual a
            WHERE s.fecha_ini < a.fecha_ini
            ORDER BY s.fecha_ini DESC
            LIMIT 1
        """
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), {"hoy": hoy})
            row = result.mappings().first()
            if row is None:
                return None
            fecha_ini = row["fecha_ini"]
            fecha_fin = row["fecha_fin"]
            if hasattr(fecha_ini, "date"):
                fecha_ini = fecha_ini.date()
            if hasattr(fecha_fin, "date"):
                fecha_fin = fecha_fin.date()
            return SemanaAnteriorRango(
                id_semana=int(row["id"]),
                fecha_inicio=fecha_ini,
                fecha_fin=fecha_fin,
            )

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

    async def exists_evento(
        self,
        *,
        no_empleado: int,
        fecha_incidencia: date,
        tipo_inc: str,
    ) -> bool:
        """True si ya hay un evento del tipo para el mismo empleado y fecha (dedupe sync)."""
        sql = """
            SELECT 1
            FROM importadas_historico
            WHERE no_empleado = :no_empleado
              AND tipo_inc = :tipo_inc
              AND fecha_incidencia = :fecha_incidencia
            LIMIT 1
        """
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(sql),
                {
                    "no_empleado": no_empleado,
                    "tipo_inc": str(tipo_inc).strip().upper(),
                    "fecha_incidencia": fecha_incidencia,
                },
            )
            return result.scalar() is not None

    async def exists_fi(self, *, no_empleado: int, fecha_incidencia: date) -> bool:
        """Compat: dedupe FI."""
        return await self.exists_evento(
            no_empleado=no_empleado,
            fecha_incidencia=fecha_incidencia,
            tipo_inc="FI",
        )

    async def list_eventos_en_rango(
        self,
        *,
        fecha_inicio: date,
        fecha_fin: date,
        tipos: tuple[str, ...] = ("FI", "RE"),
        conn: AsyncConnection | None = None,
    ) -> list[dict[str, Any]]:
        tipos_norm = [str(t).strip().upper() for t in tipos]
        if not tipos_norm:
            return []
        sql = text(
            """
            SELECT
                id,
                no_empleado,
                tipo_inc,
                inc_id,
                id_semana,
                area_empleado,
                subarea_empleado,
                fecha_incidencia
            FROM importadas_historico
            WHERE fecha_incidencia >= :fecha_inicio
              AND fecha_incidencia <= :fecha_fin
              AND tipo_inc IN :tipos
            """
        ).bindparams(bindparam("tipos", expanding=True))
        params = {
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "tipos": tipos_norm,
        }
        if conn is not None:
            result = await conn.execute(sql, params)
            rows = result.mappings().all()
        else:
            async with self._engine.connect() as c:
                result = await c.execute(sql, params)
                rows = result.mappings().all()
        return [dict(row) for row in rows]

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
        estado: int | None = None,
        conn: AsyncConnection | None = None,
    ) -> int:
        # ``estado`` es nullable: quien no lo pase (registro manual de RH) deja NULL.
        # El mirror de faltas y retardos manda 1.
        sql = """
            INSERT INTO importadas_historico (
                no_empleado,
                tipo_inc,
                inc_id,
                id_semana,
                area_empleado,
                subarea_empleado,
                fecha_incidencia,
                fecha_registro,
                estado
            )
            VALUES (
                :no_empleado,
                :tipo_inc,
                :inc_id,
                :id_semana,
                :area_empleado,
                :subarea_empleado,
                :fecha_incidencia,
                COALESCE(:fecha_registro, NOW()),
                :estado
            )
            RETURNING id
        """
        params = {
            "no_empleado": no_empleado,
            "tipo_inc": tipo_inc,
            "inc_id": inc_id,
            "id_semana": id_semana,
            "area_empleado": area_empleado,
            "subarea_empleado": subarea_empleado,
            "fecha_incidencia": fecha_incidencia,
            "fecha_registro": fecha_registro,
            "estado": estado,
        }
        if conn is not None:
            result = await conn.execute(text(sql), params)
            new_id = result.scalar()
        else:
            async with self._engine.begin() as c:
                result = await c.execute(text(sql), params)
                new_id = result.scalar()
        if new_id is None:
            raise RuntimeError("INSERT en importadas_historico no devolvió id")
        return int(new_id)

    async def update_evento(
        self,
        *,
        evento_id: int,
        inc_id: int,
        id_semana: int,
        area_empleado: int | None,
        subarea_empleado: int | None,
        conn: AsyncConnection | None = None,
    ) -> None:
        sql = """
            UPDATE importadas_historico
            SET
                inc_id = :inc_id,
                id_semana = :id_semana,
                area_empleado = :area_empleado,
                subarea_empleado = :subarea_empleado
            WHERE id = :evento_id
        """
        params = {
            "evento_id": evento_id,
            "inc_id": inc_id,
            "id_semana": id_semana,
            "area_empleado": area_empleado,
            "subarea_empleado": subarea_empleado,
        }
        if conn is not None:
            await conn.execute(text(sql), params)
        else:
            async with self._engine.begin() as c:
                await c.execute(text(sql), params)

    async def delete_evento_by_id(
        self,
        *,
        evento_id: int,
        conn: AsyncConnection | None = None,
    ) -> None:
        sql = "DELETE FROM importadas_historico WHERE id = :evento_id"
        params = {"evento_id": evento_id}
        if conn is not None:
            await conn.execute(text(sql), params)
        else:
            async with self._engine.begin() as c:
                await c.execute(text(sql), params)

    async def fetch_evento_row(self, origen_id: int) -> dict[str, Any] | None:
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(self._fetch_sql), {"origen_id": origen_id}
            )
            row = result.mappings().first()
            return dict(row) if row else None
