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


def sumar_dias_habiles(fecha_inicio: date, dias_habiles: int) -> date:
    """Devuelve la fecha del día hábil N inclusive (lunes–viernes) desde fecha_inicio."""
    cursor = fecha_inicio
    acumulados = 1
    while acumulados < dias_habiles:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5:
            acumulados += 1
    return cursor


DEFUNCION_DIAS_FIJOS = 3


def defuncion_rango_calendario(fecha_inicio: date) -> tuple[date, date]:
    """Defunción: 3 días naturales consecutivos."""
    return fecha_inicio, fecha_inicio + timedelta(days=DEFUNCION_DIAS_FIJOS - 1)


def defuncion_rango_administrativo(fecha_referencia: date) -> tuple[date, date]:
    """
    Defunción para administrativos: 3 días hábiles.
    Si el rango natural de 3 días cruza fin de semana, ajusta al bloque hábil más cercano.
    """
    _, fin_cal = defuncion_rango_calendario(fecha_referencia)
    if (
        not rango_incluye_fin_de_semana(fecha_referencia, fin_cal)
        and dias_laborales_inclusive(fecha_referencia, fin_cal) == DEFUNCION_DIAS_FIJOS
    ):
        return fecha_referencia, fin_cal
    cursor = fecha_referencia
    while cursor.weekday() >= 5:
        cursor += timedelta(days=1)
    fin = sumar_dias_habiles(cursor, DEFUNCION_DIAS_FIJOS)
    return cursor, fin


def defuncion_rango_para_empleado(fecha_referencia: date, *, administrativo: bool) -> tuple[date, date]:
    if administrativo:
        return defuncion_rango_administrativo(fecha_referencia)
    return defuncion_rango_calendario(fecha_referencia)
