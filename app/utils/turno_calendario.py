"""Proyección de días LABORABLE/DESCANSO a partir de TURNO TRESS (fijo/rotativo).

La expansión de ``TU_RIT_PAT`` replica ``dbo.FN_GeneraRitmo``:
los tokens alternan tipo de día (hábil → descanso, o hábil → sábado → descanso
si el patrón inicia con ``#``). El valor del token es la cantidad de días
(``N`` o ``N:CODIGO_HORARIO``). El token ``0`` inserta cero días y solo avanza
la fase; por eso los descansos rotativos suelen venir en pares consecutivos
(p. ej. el segundo ``2:03`` de un bloque cae en fase descanso).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

TipoTurno = Literal["FIJO", "ROTATIVO"]
EstatusDia = Literal["LABORABLE", "DESCANSO"]

_AU_HABIL = 0
_AU_SABADO = 1
_AU_DESCANSO = 2

_TOKEN_RE = re.compile(r"^(\d+)(?::(\d+))?$")


@dataclass(frozen=True, slots=True)
class TurnoTress:
    codigo: str
    rit_pat: str | None
    rit_ini: date | None
    tips: tuple[int, int, int, int, int, int, int]
    hors: tuple[str, str, str, str, str, str, str]

    @property
    def es_rotativo(self) -> bool:
        return bool((self.rit_pat or "").strip())


@dataclass(frozen=True, slots=True)
class DiaRitmo:
    """Un día del ciclo expandido por ``FN_GeneraRitmo``."""

    codigo_horario: str | None
    tipo_dia: int  # 0 hábil, 1 sábado, 2 descanso


@dataclass(frozen=True, slots=True)
class DiaCalendario:
    fecha: date
    turno: str
    tipo_turno: TipoTurno
    codigo_horario: str | None
    estatus: EstatusDia
    hora_entrada: time | None = None
    hora_salida: time | None = None
    jornada: Decimal | None = None


def normalizar_codigo(value: str | None) -> str:
    return (value or "").strip()


def aplanar_patron_rotativo(patron: str) -> str:
    """Normaliza saltos de línea de ``TU_RIT_PAT`` a lista de tokens por coma."""
    parts: list[str] = []
    cleaned = (patron or "").replace("\r\n", ",").replace("\n", ",").replace("\r", ",")
    for raw in cleaned.split(","):
        tok = raw.strip()
        if tok:
            parts.append(tok)
    return ",".join(parts)


def expandir_patron_rotativo(
    patron: str,
    *,
    horario1: str = "",
    horario2: str = "",
    horario3: str = "",
) -> list[DiaRitmo]:
    """Expande ``TU_RIT_PAT`` como ``dbo.FN_GeneraRitmo``.

    - Tokens separados por coma (tras aplanar saltos de línea).
    - Prefijo ``#``: ciclo hábil → sábado → descanso.
    - Sin ``#``: ciclo hábil → descanso.
    - ``N`` o ``N:COD``: N días del tipo de fase actual.
    - ``0``: cero días (salta la fase sin insertar fechas).
    """
    flat = aplanar_patron_rotativo(patron)
    if not flat:
        raise ValueError("El patrón rotativo quedó vacío tras expandir")

    usa_sabados = flat.startswith("#")
    body = flat[1:] if usa_sabados else flat
    if not body:
        raise ValueError("El patrón rotativo quedó vacío tras expandir")

    h1 = normalizar_codigo(horario1)
    h2 = normalizar_codigo(horario2)
    h3 = normalizar_codigo(horario3)

    status = _AU_HABIL
    ritmos: list[tuple[str, int]] = []
    for tok in body.split(","):
        ritmos.append((tok, status))
        if status == _AU_HABIL and usa_sabados:
            status = _AU_SABADO
        elif status == _AU_HABIL and not usa_sabados:
            status = _AU_DESCANSO
        elif status == _AU_SABADO:
            status = _AU_DESCANSO
        elif status == _AU_DESCANSO:
            status = _AU_HABIL
        else:
            status = _AU_HABIL

    ciclo: list[DiaRitmo] = []
    for tok, tipo_dia in ritmos:
        # FN_GeneraRitmo recorta sufijo `%…` del token.
        if "%" in tok:
            tok = tok[: tok.index("%")]
        match = _TOKEN_RE.fullmatch(tok)
        if match is None:
            raise ValueError(f"Token de patrón rotativo inválido: {tok!r}")
        dias = int(match.group(1))
        codigo_raw = match.group(2)
        if dias < 0:
            raise ValueError(f"Conteo inválido en patrón rotativo: {tok!r}")

        if codigo_raw is not None and codigo_raw != "":
            codigo = normalizar_codigo(codigo_raw) or None
        else:
            if tipo_dia == _AU_HABIL:
                codigo = h1 or None
            elif tipo_dia == _AU_SABADO:
                codigo = h2 or None
            elif tipo_dia == _AU_DESCANSO and usa_sabados:
                codigo = h3 or None
            elif tipo_dia == _AU_DESCANSO and not usa_sabados:
                codigo = h2 or None
            else:
                codigo = h1 or None

        for _ in range(dias):
            ciclo.append(DiaRitmo(codigo_horario=codigo, tipo_dia=tipo_dia))

    if not ciclo:
        raise ValueError("El patrón rotativo quedó vacío tras expandir")
    return ciclo


def _horario_de(
    codigo: str | None,
    horarios: dict[str, tuple[time | None, time | None, Decimal | None]],
) -> tuple[str | None, time | None, time | None, Decimal | None]:
    if not codigo:
        return None, None, None, None
    key = normalizar_codigo(codigo)
    entrada, salida, jornada = horarios.get(key, (None, None, None))
    return key, entrada, salida, jornada


def proyectar_dia(
    turno: TurnoTress,
    fecha: date,
    *,
    horarios: dict[str, tuple[time | None, time | None, Decimal | None]] | None = None,
) -> DiaCalendario:
    horarios = horarios or {}
    codigo_turno = normalizar_codigo(turno.codigo)

    if turno.es_rotativo:
        if turno.rit_ini is None:
            raise ValueError(f"Turno rotativo {codigo_turno} sin TU_RIT_INI")
        if fecha < turno.rit_ini:
            raise ValueError(
                f"Fecha {fecha} anterior a TU_RIT_INI {turno.rit_ini} del turno {codigo_turno}"
            )
        ciclo = expandir_patron_rotativo(
            turno.rit_pat or "",
            horario1=turno.hors[0],
            horario2=turno.hors[1],
            horario3=turno.hors[2],
        )
        idx = (fecha - turno.rit_ini).days % len(ciclo)
        dia_ritmo = ciclo[idx]
        if dia_ritmo.tipo_dia == _AU_DESCANSO:
            return DiaCalendario(
                fecha=fecha,
                turno=codigo_turno,
                tipo_turno="ROTATIVO",
                codigo_horario=None,
                estatus="DESCANSO",
            )
        codigo, entrada, salida, jornada = _horario_de(dia_ritmo.codigo_horario, horarios)
        return DiaCalendario(
            fecha=fecha,
            turno=codigo_turno,
            tipo_turno="ROTATIVO",
            codigo_horario=codigo,
            estatus="LABORABLE",
            hora_entrada=entrada,
            hora_salida=salida,
            jornada=jornada,
        )

    # Fijo: weekday() lunes=0 … domingo=6 → TU_TIP_1..7
    tip = turno.tips[fecha.weekday()]
    if tip == 2:
        return DiaCalendario(
            fecha=fecha,
            turno=codigo_turno,
            tipo_turno="FIJO",
            codigo_horario=None,
            estatus="DESCANSO",
        )
    codigo_horario = normalizar_codigo(turno.hors[fecha.weekday()]) or None
    codigo, entrada, salida, jornada = _horario_de(codigo_horario, horarios)
    return DiaCalendario(
        fecha=fecha,
        turno=codigo_turno,
        tipo_turno="FIJO",
        codigo_horario=codigo,
        estatus="LABORABLE",
        hora_entrada=entrada,
        hora_salida=salida,
        jornada=jornada,
    )


def aplicar_override_ausencia(
    dias: list[DiaCalendario],
    ausencias_por_fecha: dict[date, int],
) -> list[DiaCalendario]:
    """Si existe fila en AUSENCIA, AU_STATUS=2 pisa como DESCANSO; otro status como LABORABLE."""
    result: list[DiaCalendario] = []
    for dia in dias:
        if dia.fecha not in ausencias_por_fecha:
            result.append(dia)
            continue
        status = ausencias_por_fecha[dia.fecha]
        estatus: EstatusDia = "DESCANSO" if status == 2 else "LABORABLE"
        result.append(
            DiaCalendario(
                fecha=dia.fecha,
                turno=dia.turno,
                tipo_turno=dia.tipo_turno,
                codigo_horario=None if estatus == "DESCANSO" else dia.codigo_horario,
                estatus=estatus,
                hora_entrada=None if estatus == "DESCANSO" else dia.hora_entrada,
                hora_salida=None if estatus == "DESCANSO" else dia.hora_salida,
                jornada=None if estatus == "DESCANSO" else dia.jornada,
            )
        )
    return result


def proyectar_calendario(
    *,
    turnos_por_fecha: dict[date, TurnoTress],
    ausencias_por_fecha: dict[date, int],
    horarios: dict[str, tuple[time | None, time | None, Decimal | None]] | None = None,
) -> list[DiaCalendario]:
    proyectados = [
        proyectar_dia(turnos_por_fecha[fecha], fecha, horarios=horarios)
        for fecha in sorted(turnos_por_fecha)
    ]
    return aplicar_override_ausencia(proyectados, ausencias_por_fecha)


def fechas_descanso(dias: list[DiaCalendario]) -> list[date]:
    return [d.fecha for d in dias if d.estatus == "DESCANSO"]


def coerce_date(value: date | datetime | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    return value
