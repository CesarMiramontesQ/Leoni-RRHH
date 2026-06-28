"""Reglas de fechas para solicitudes (vacaciones, home office)."""

from __future__ import annotations

from datetime import date, timedelta


def rango_incluye_fin_de_semana(fecha_inicio: date, fecha_fin: date) -> bool:
    """True si algún día del rango inclusive cae en sábado o domingo."""
    cursor = fecha_inicio
    while cursor <= fecha_fin:
        if cursor.weekday() >= 5:
            return True
        cursor += timedelta(days=1)
    return False


def dias_laborales_inclusive(fecha_inicio: date, fecha_fin: date) -> int:
    """Cuenta lunes–viernes en el rango inclusive."""
    total = 0
    cursor = fecha_inicio
    while cursor <= fecha_fin:
        if cursor.weekday() < 5:
            total += 1
        cursor += timedelta(days=1)
    return total
