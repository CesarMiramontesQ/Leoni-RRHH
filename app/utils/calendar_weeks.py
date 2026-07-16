"""Partición de rangos de fechas por semana calendario (lunes–domingo)."""

from __future__ import annotations

from datetime import date, timedelta


def split_calendar_weeks(fecha_inicio: date, fecha_fin: date) -> list[tuple[date, date]]:
    """
    Parte ``[fecha_inicio, fecha_fin]`` (ambos inclusive) en tramos lun–dom.

    Cada tramo es ``(inicio, fin)`` inclusive. Si el rango no cruza domingo→lunes,
    devuelve un solo tramo.
    """
    if fecha_fin < fecha_inicio:
        raise ValueError("fecha_fin no puede ser anterior a fecha_inicio")

    tramos: list[tuple[date, date]] = []
    cur = fecha_inicio
    while cur <= fecha_fin:
        # weekday(): lun=0 … dom=6 → domingo de esa semana
        domingo = cur + timedelta(days=(6 - cur.weekday()))
        seg_fin = min(domingo, fecha_fin)
        tramos.append((cur, seg_fin))
        cur = seg_fin + timedelta(days=1)
    return tramos
