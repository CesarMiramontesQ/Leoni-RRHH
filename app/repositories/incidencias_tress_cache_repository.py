"""Acceso a `levelup_incidencias_tress`, la caché en Bono de las incidencias de TRESS.

Los métodos de escritura los usa el sync; los de lectura y agregado, la página
Incidencias. Ninguno toca datos-analisis.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.empleados import Empleado
from app.models.incidencias_tress import IncidenciaTress


class IncidenciasTressCacheRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Sync ─────────────────────────────────────────────────────────────────

    async def map_existentes(
        self, desde: date | None, hasta: date | None
    ) -> dict[tuple[str, int], IncidenciaTress]:
        """Filas del rango indexadas por su llave de idempotencia.

        Solape, no corte estricto por `fecha_evento`: mismo criterio que
        `FaltasRetardosRepository._apply_filters` y la rama de permisos del SQL de
        datos-analisis. Una fila de rango (incapacidad, suspensión, permiso con goce)
        puede tener `fecha_evento` anterior a `desde` y seguir vigente (`fecha_fin`
        dentro de la ventana); ambas fuentes la vuelven a traer en esa corrida, así que
        también debe contar como "existente" aquí — si no, se reinserta y revienta el
        `UNIQUE (origen, origen_id)`.
        """
        stmt = select(IncidenciaTress)
        if desde is not None:
            stmt = stmt.where(
                func.coalesce(IncidenciaTress.fecha_fin, IncidenciaTress.fecha_evento)
                >= desde
            )
        if hasta is not None:
            stmt = stmt.where(IncidenciaTress.fecha_evento <= hasta)
        result = await self.db.execute(stmt)
        return {
            (fila.origen, fila.origen_id): fila for fila in result.scalars().all()
        }

    async def delete_llaves(self, llaves: set[tuple[str, int]]) -> int:
        """Borra por (origen, origen_id). Devuelve cuántas filas se fueron."""
        if not llaves:
            return 0
        borradas = 0
        for origen, origen_id in llaves:
            result = await self.db.execute(
                delete(IncidenciaTress).where(
                    IncidenciaTress.origen == origen,
                    IncidenciaTress.origen_id == origen_id,
                )
            )
            borradas += int(result.rowcount or 0)
        return borradas

    # ── Lectura (página Incidencias) ──────────────────────────────────────────

    @staticmethod
    def _filtros(
        *,
        fecha_inicio: date | None,
        fecha_fin: date | None,
        cb_codigos: list[int] | None,
        tipo: str | None,
    ) -> list:
        # Incidencias de gente que no existe en Bono: fuera. TRESS tiene CB_CODIGO que
        # nunca se dieron de alta aquí, y el sync los deja con `empleado_id` NULL (ver el
        # modelo). Sin nombre ni ficha no le sirven a RH y descuadran cada total. El
        # predicado vive en el helper —no en cada método— para que el `total` de la
        # paginación, la tabla y los agregados sigan contando exactamente lo mismo.
        # No se borran de la caché: si el empleado se da de alta después, el sync le
        # estampa el `empleado_id` y sus incidencias reaparecen solas.
        conds: list = [IncidenciaTress.empleado_id.is_not(None)]
        if fecha_inicio is not None:
            # Un evento con rango cuenta si sigue vigente dentro de la ventana, aunque
            # haya empezado antes: misma semántica que el SQL de datos-analisis.
            conds.append(
                func.coalesce(IncidenciaTress.fecha_fin, IncidenciaTress.fecha_evento)
                >= fecha_inicio
            )
        if fecha_fin is not None:
            conds.append(IncidenciaTress.fecha_evento <= fecha_fin)
        if cb_codigos is not None:
            # Lista vacía = ningún empleado pasa el filtro; no equivale a "sin filtro".
            conds.append(IncidenciaTress.no_empleado.in_(cb_codigos or [-1]))
        if tipo and tipo.strip():
            conds.append(IncidenciaTress.tipo == tipo.strip())
        return conds

    async def count(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(IncidenciaTress).where(
            *self._filtros(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                cb_codigos=cb_codigos,
                tipo=tipo,
            )
        )
        return int((await self.db.execute(stmt)).scalar() or 0)

    async def list_offset(
        self,
        offset: int,
        limit: int,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[dict]:
        """Filas de la página, ya con el nombre del empleado y de quien registró.

        El join sale gratis porque la caché y `empleados` viven en la misma BD; antes
        esto era un viaje aparte por cada página.
        """
        emp = aliased(Empleado)
        registrador = aliased(Empleado)
        stmt = (
            select(
                IncidenciaTress.origen,
                IncidenciaTress.origen_id,
                IncidenciaTress.no_empleado,
                IncidenciaTress.empleado_id,
                emp.nombre.label("empleado_nombre"),
                IncidenciaTress.tipo,
                IncidenciaTress.fecha_evento,
                IncidenciaTress.fecha_fin,
                IncidenciaTress.observaciones,
                IncidenciaTress.fecha_registro,
                IncidenciaTress.registrado_por_id,
                registrador.nombre.label("registrado_por_nombre"),
            )
            .outerjoin(emp, emp.empleado_id == IncidenciaTress.empleado_id)
            .outerjoin(
                registrador, registrador.empleado_id == IncidenciaTress.registrado_por_id
            )
            .where(
                *self._filtros(
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    cb_codigos=cb_codigos,
                    tipo=tipo,
                )
            )
            # Misma terna determinista que usaba datos-analisis.
            .order_by(
                IncidenciaTress.fecha_evento.desc(),
                IncidenciaTress.origen.asc(),
                IncidenciaTress.origen_id.desc(),
            )
            .offset(max(0, offset))
            .limit(max(0, limit))
        )
        result = await self.db.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def aggregate_por_tipo(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> dict[str, int]:
        stmt = (
            select(IncidenciaTress.tipo, func.count().label("cnt"))
            .where(
                *self._filtros(
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    cb_codigos=cb_codigos,
                    tipo=tipo,
                )
            )
            .group_by(IncidenciaTress.tipo)
        )
        result = await self.db.execute(stmt)
        return {str(clave): int(cnt) for clave, cnt in result.all() if clave}

    async def aggregate_por_periodo_y_tipo(
        self,
        *,
        agrupacion: str,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[tuple[str, str, int]]:
        """Agrupa por día y tipo en SQL, y arma el periodo en Python.

        PostgreSQL sí tiene `date_trunc` y `to_char`, pero SQLite —donde corren los
        tests— no: agrupar por día en la BD y armar el periodo aquí es lo único que
        funciona igual en ambas. El agrupado por día ya reduce el volumen que viaja.
        """
        stmt = (
            select(
                IncidenciaTress.fecha_evento,
                IncidenciaTress.tipo,
                func.count().label("cnt"),
            )
            .where(
                *self._filtros(
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    cb_codigos=cb_codigos,
                    tipo=tipo,
                )
            )
            .group_by(IncidenciaTress.fecha_evento, IncidenciaTress.tipo)
        )
        result = await self.db.execute(stmt)
        merged: dict[tuple[str, str], int] = {}
        for fecha, clave, cnt in result.all():
            if fecha is None or not clave:
                continue
            llave = (periodo_de_fecha(fecha, agrupacion), str(clave))
            merged[llave] = merged.get(llave, 0) + int(cnt)
        return [
            (periodo, clave, total)
            for (periodo, clave), total in sorted(merged.items())
        ]

    async def aggregate_por_mes(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[tuple[str, int]]:
        rows = await self.aggregate_por_periodo_y_tipo(
            agrupacion="mes",
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            cb_codigos=cb_codigos,
            tipo=tipo,
        )
        merged: dict[str, int] = {}
        for periodo, _clave, count in rows:
            merged[periodo] = merged.get(periodo, 0) + count
        return sorted(merged.items())

    async def aggregate_empleados_top(
        self,
        *,
        limit: int = 10,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[tuple[int, int, dict[str, int]]]:
        """(no_empleado, total, {tipo: total}) de los empleados con más eventos."""
        stmt = (
            select(
                IncidenciaTress.no_empleado,
                IncidenciaTress.tipo,
                func.count().label("cnt"),
            )
            .where(
                *self._filtros(
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    cb_codigos=cb_codigos,
                    tipo=tipo,
                )
            )
            .group_by(IncidenciaTress.no_empleado, IncidenciaTress.tipo)
        )
        result = await self.db.execute(stmt)
        por_empleado: dict[int, dict[str, int]] = {}
        for no_empleado, clave, cnt in result.all():
            if no_empleado is None or not clave:
                continue
            destino = por_empleado.setdefault(int(no_empleado), {})
            destino[str(clave)] = destino.get(str(clave), 0) + int(cnt)

        totales = [
            (no_empleado, sum(por_tipo.values()), por_tipo)
            for no_empleado, por_tipo in por_empleado.items()
        ]
        totales.sort(key=lambda item: (-item[1], item[0]))
        return totales[: max(0, int(limit))]


def periodo_de_fecha(fecha: date, agrupacion: str) -> str:
    """Etiqueta del periodo: día ISO, lunes de la semana, o `YYYY-MM`."""
    if agrupacion == "dia":
        return fecha.isoformat()
    if agrupacion == "semana":
        return (fecha - timedelta(days=fecha.weekday())).isoformat()
    return fecha.strftime("%Y-%m")
