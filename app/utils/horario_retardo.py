"""Horas de TRESS: formato 'HHMM' → 'HH:MM' y minutos de retardo.

TRESS guarda las horas de `dbo.HORARIO.HO_INTIME` y `dbo.CHECADAS.CH_H_REAL` como
char de 4 posiciones, y expresa «al día siguiente» con horas >= 24: un turno que entra
a las 18:00 y checa a la 01:00 queda como '2500'. Esa convención se conserva tal cual
—normalizarla aquí perdería el «+1 día»— y es también lo que hace que la resta de
minutos funcione sin casos especiales para el turno nocturno.

Funciones puras: no tocan ninguna BD. Las usa `DatosAnalisisFaltasRetardosRepository`
al normalizar las filas que lee del SQL base.
"""

from __future__ import annotations


def _a_minutos(hora: str | None) -> int | None:
    """Minutos desde la medianoche del día de la jornada, o None si no es legible."""
    if hora is None:
        return None
    limpia = str(hora).strip()
    if len(limpia) != 4 or not limpia.isdigit():
        return None
    horas, minutos = int(limpia[:2]), int(limpia[2:])
    if minutos > 59:
        return None
    return horas * 60 + minutos


def formatear_hora_tress(hora: str | None) -> str | None:
    """'0627' → '06:27'. Devuelve None si el valor falta o no es una hora."""
    if _a_minutos(hora) is None:
        return None
    limpia = str(hora).strip()
    return f"{limpia[:2]}:{limpia[2:]}"


def minutos_de_retardo(*, programada: str | None, entrada: str | None) -> int | None:
    """Minutos entre la hora programada y la checada de entrada.

    Devuelve None cuando falta alguna de las dos o cuando la diferencia sale negativa:
    hay retardos en TRESS cuya checada es anterior a la hora programada (~0.2%), y un
    "-58 min" en pantalla sería peor que no mostrar nada.
    """
    inicio = _a_minutos(programada)
    llegada = _a_minutos(entrada)
    if inicio is None or llegada is None:
        return None
    diferencia = llegada - inicio
    return diferencia if diferencia >= 0 else None
