"""Cálculos puros de fechas efectivas al excluir descansos TRESS."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, timedelta

from app.utils.calendar_weeks import split_calendar_weeks


def fechas_efectivas_en_rango(
    fecha_inicio: date,
    fecha_fin: date,
    descansos: Iterable[date],
) -> list[date]:
    """Devuelve las fechas inclusivas del rango que no son descanso."""
    if fecha_fin < fecha_inicio:
        raise ValueError("fecha_fin no puede ser anterior a fecha_inicio")
    descansos_set = set(descansos)
    return [
        fecha_inicio + timedelta(days=offset)
        for offset in range((fecha_fin - fecha_inicio).days + 1)
        if fecha_inicio + timedelta(days=offset) not in descansos_set
    ]


def avanzar_hasta_reunir_dias(
    fecha_inicio: date,
    cantidad: int,
    descansos: Iterable[date],
    *,
    solo_lunes_viernes: bool = False,
) -> list[date]:
    """Reúne ``cantidad`` de fechas otorgables sin consumir descansos."""
    if cantidad <= 0:
        raise ValueError("cantidad debe ser mayor a cero")
    descansos_set = set(descansos)
    fechas: list[date] = []
    cursor = fecha_inicio
    while len(fechas) < cantidad:
        es_dia_permitido = not solo_lunes_viernes or cursor.weekday() < 5
        if es_dia_permitido and cursor not in descansos_set:
            fechas.append(cursor)
        cursor += timedelta(days=1)
    return fechas


def tramos_consecutivos(fechas: Iterable[date]) -> list[tuple[date, date]]:
    """Agrupa fechas únicas en tramos calendario máximos consecutivos."""
    ordenadas = sorted(set(fechas))
    if not ordenadas:
        return []
    tramos: list[tuple[date, date]] = []
    inicio = fin = ordenadas[0]
    for fecha in ordenadas[1:]:
        if fecha == fin + timedelta(days=1):
            fin = fecha
            continue
        tramos.append((inicio, fin))
        inicio = fin = fecha
    tramos.append((inicio, fin))
    return tramos


def partir_tramos_por_semanas(
    tramos: Iterable[tuple[date, date]],
) -> list[tuple[date, date]]:
    """Parte cada tramo consecutivo adicionalmente por lunes–domingo."""
    return [
        semana
        for fecha_inicio, fecha_fin in tramos
        for semana in split_calendar_weeks(fecha_inicio, fecha_fin)
    ]
