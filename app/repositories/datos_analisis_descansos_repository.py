"""Repositorio de descansos TRESS: proyección TURNO/Kardex + override AUSENCIA."""

from __future__ import annotations

from datetime import date, time, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.utils.turno_calendario import (
    DiaCalendario,
    TurnoTress,
    aplicar_override_ausencia,
    coerce_date,
    expandir_patron_rotativo,
    fechas_descanso,
    normalizar_codigo,
    proyectar_dia,
)

_SQL_DIR = Path(__file__).resolve().parent / "sql"

_TURNO_PLACEHOLDER = TurnoTress(
    codigo="?",
    rit_pat=None,
    rit_ini=None,
    tips=(0, 0, 0, 0, 0, 0, 0),
    hors=("", "", "", "", "", "", ""),
)


def _load_sql(name: str) -> str:
    return (_SQL_DIR / name).read_text(encoding="utf-8")


def load_turnos_por_fecha_sql() -> str:
    return _load_sql("datos_analisis_turnos_por_fecha.sql")


def load_turno_por_codigo_sql() -> str:
    return _load_sql("datos_analisis_turno_por_codigo.sql")


def load_ausencias_estatus_rango_sql() -> str:
    return _load_sql("datos_analisis_ausencias_estatus_rango.sql")


def load_horario_por_codigo_sql() -> str:
    return _load_sql("datos_analisis_horario_por_codigo.sql")


def parse_hora_tress(value: str | None) -> time | None:
    raw = (value or "").strip()
    if not raw or not raw.isdigit() or len(raw) not in (3, 4):
        return None
    padded = raw.zfill(4)
    hour = int(padded[:2])
    minute = int(padded[2:])
    if hour > 23 or minute > 59:
        return None
    return time(hour, minute)


def _row_to_turno(row: dict) -> TurnoTress:
    return TurnoTress(
        codigo=normalizar_codigo(str(row.get("tu_codigo") or "")),
        rit_pat=row.get("tu_rit_pat"),
        rit_ini=coerce_date(row.get("tu_rit_ini")),
        tips=(
            int(row.get("tu_tip_1") or 0),
            int(row.get("tu_tip_2") or 0),
            int(row.get("tu_tip_3") or 0),
            int(row.get("tu_tip_4") or 0),
            int(row.get("tu_tip_5") or 0),
            int(row.get("tu_tip_6") or 0),
            int(row.get("tu_tip_7") or 0),
        ),
        hors=(
            normalizar_codigo(str(row.get("tu_hor_1") or "")),
            normalizar_codigo(str(row.get("tu_hor_2") or "")),
            normalizar_codigo(str(row.get("tu_hor_3") or "")),
            normalizar_codigo(str(row.get("tu_hor_4") or "")),
            normalizar_codigo(str(row.get("tu_hor_5") or "")),
            normalizar_codigo(str(row.get("tu_hor_6") or "")),
            normalizar_codigo(str(row.get("tu_hor_7") or "")),
        ),
    )


class DatosAnalisisDescansosRepository:
    """Proyecta descansos por Kardex+TURNO y aplica override de AUSENCIA."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine
        self._sql_turnos_fecha = load_turnos_por_fecha_sql()
        self._sql_turno = load_turno_por_codigo_sql()
        self._sql_ausencias = load_ausencias_estatus_rango_sql()
        self._sql_horario = load_horario_por_codigo_sql()

    async def list_turnos_por_fecha(
        self,
        *,
        cb_codigo: int,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> dict[date, str]:
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(self._sql_turnos_fecha),
                {
                    "cb_codigo": cb_codigo,
                    "fecha_inicio": fecha_inicio,
                    "fecha_fin": fecha_fin,
                },
            )
            rows = result.mappings().all()
        out: dict[date, str] = {}
        for row in rows:
            fecha = coerce_date(row.get("fecha"))
            if fecha is None:
                continue
            out[fecha] = normalizar_codigo(str(row.get("turno") or ""))
        return out

    async def get_turno(self, tu_codigo: str) -> TurnoTress | None:
        codigo = normalizar_codigo(tu_codigo)
        if not codigo:
            return None
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(self._sql_turno),
                {"tu_codigo": codigo},
            )
            row = result.mappings().first()
        if row is None:
            return None
        return _row_to_turno(dict(row))

    async def list_ausencias_estatus(
        self,
        *,
        cb_codigo: int,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> dict[date, int]:
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(self._sql_ausencias),
                {
                    "cb_codigo": cb_codigo,
                    "fecha_inicio": fecha_inicio,
                    "fecha_fin": fecha_fin,
                },
            )
            rows = result.mappings().all()
        out: dict[date, int] = {}
        for row in rows:
            fecha = coerce_date(row.get("fecha"))
            if fecha is None:
                continue
            status = row.get("au_status")
            out[fecha] = int(status) if status is not None else 0
        return out

    async def get_horario(
        self, ho_codigo: str
    ) -> tuple[time | None, time | None, Decimal | None] | None:
        codigo = normalizar_codigo(ho_codigo)
        if not codigo:
            return None
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(self._sql_horario),
                {"ho_codigo": codigo},
            )
            row = result.mappings().first()
        if row is None:
            return None
        jornada_raw = row.get("ho_jornada")
        jornada = Decimal(str(jornada_raw)) if jornada_raw is not None else None
        return (
            parse_hora_tress(str(row.get("ho_intime") or "")),
            parse_hora_tress(str(row.get("ho_outtime") or "")),
            jornada,
        )

    async def _cargar_horarios(
        self, turnos: list[TurnoTress]
    ) -> dict[str, tuple[time | None, time | None, Decimal | None]]:
        codigos: set[str] = set()
        for turno in turnos:
            if turno.es_rotativo and turno.rit_pat:
                try:
                    for item in expandir_patron_rotativo(
                        turno.rit_pat,
                        horario1=turno.hors[0],
                        horario2=turno.hors[1],
                        horario3=turno.hors[2],
                    ):
                        if item.codigo_horario:
                            codigos.add(item.codigo_horario)
                except ValueError:
                    continue
            else:
                for hor in turno.hors:
                    if hor:
                        codigos.add(hor)
        horarios: dict[str, tuple[time | None, time | None, Decimal | None]] = {}
        for codigo in sorted(codigos):
            horario = await self.get_horario(codigo)
            if horario is not None:
                horarios[codigo] = horario
        return horarios

    async def proyectar_calendario_empleado(
        self,
        *,
        cb_codigo: int,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> list[DiaCalendario]:
        turnos_codigos = await self.list_turnos_por_fecha(
            cb_codigo=cb_codigo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )
        ausencias = await self.list_ausencias_estatus(
            cb_codigo=cb_codigo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )

        cache_turnos: dict[str, TurnoTress] = {}
        turnos_por_fecha: dict[date, TurnoTress] = {}
        for fecha, codigo in sorted(turnos_codigos.items()):
            if codigo not in cache_turnos:
                loaded = await self.get_turno(codigo)
                cache_turnos[codigo] = loaded or TurnoTress(
                    codigo=codigo or "?",
                    rit_pat=None,
                    rit_ini=None,
                    tips=(0, 0, 0, 0, 0, 0, 0),
                    hors=("", "", "", "", "", "", ""),
                )
            turnos_por_fecha[fecha] = cache_turnos[codigo]

        cursor = fecha_inicio
        while cursor <= fecha_fin:
            if cursor not in turnos_por_fecha and cursor in ausencias:
                turnos_por_fecha[cursor] = _TURNO_PLACEHOLDER
            cursor += timedelta(days=1)

        horarios = await self._cargar_horarios(list(turnos_por_fecha.values()))
        proyectados: list[DiaCalendario] = []
        for fecha in sorted(turnos_por_fecha):
            turno = turnos_por_fecha[fecha]
            try:
                proyectados.append(proyectar_dia(turno, fecha, horarios=horarios))
            except ValueError:
                proyectados.append(
                    DiaCalendario(
                        fecha=fecha,
                        turno=normalizar_codigo(turno.codigo),
                        tipo_turno="ROTATIVO" if turno.es_rotativo else "FIJO",
                        codigo_horario=None,
                        estatus="LABORABLE",
                    )
                )
        return aplicar_override_ausencia(proyectados, ausencias)

    async def list_descansos(
        self,
        *,
        cb_codigo: int,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> list[date]:
        dias = await self.proyectar_calendario_empleado(
            cb_codigo=cb_codigo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )
        return fechas_descanso(dias)
