"""Fecha y hora de negocio (zona configurable) para comedor y accesos."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from zoneinfo import ZoneInfo

from app.core.config import settings


def lunes_de_semana_contiene(d: date) -> date:
    """Lunes ISO (weekday 0 = lunes) de la semana calendario que contiene `d`."""
    return d - timedelta(days=d.weekday())


def primer_lunes_reserva_comedor_permitido(hoy: date) -> date:
    """
    Primera fecha en que un empleado puede agendar comidas en el comedor:
    lunes de la semana siguiente a la semana calendario actual (lunes–domingo).
    """
    lunes_actual = lunes_de_semana_contiene(hoy)
    return lunes_actual + timedelta(days=7)


def business_today() -> date:
    tz = ZoneInfo(settings.APP_TIMEZONE)
    return datetime.now(tz).date()


def business_now() -> datetime:
    tz = ZoneInfo(settings.APP_TIMEZONE)
    return datetime.now(tz)


def dentro_ventana_acceso_comedor(now: datetime) -> bool:
    """
    True si la ventana horaria no está configurada o si `now` cae dentro del rango HH:MM.
    Comparación en minutos desde medianoche en la misma fecha local de `now`.
    """
    ini_s = (settings.COMEDOR_ACCESO_HORA_INICIO or "").strip()
    fin_s = (settings.COMEDOR_ACCESO_HORA_FIN or "").strip()
    if not ini_s or not fin_s:
        return True

    def _to_minutes(hm: str) -> int:
        parts = hm.split(":")
        h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
        return h * 60 + m

    cur = now.hour * 60 + now.minute
    return _to_minutes(ini_s) <= cur <= _to_minutes(fin_s)
