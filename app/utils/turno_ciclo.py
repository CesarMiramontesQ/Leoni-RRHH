"""Ciclo de un turno visto como bloques: lo que Ajustes Comedor necesita mostrar y editar.

Envuelve `app.utils.turno_calendario` sin modificarlo. Ese módulo replica
``dbo.FN_GeneraRitmo`` y está validado día a día contra lo que TRESS mismo calculó
(``dbo.AUSENCIA.HO_CODIGO``), así que la expansión del patrón se reutiliza tal cual; aquí
solo se agrega lo que la pantalla necesita y el motor no da:

- tratar un turno **fijo** con la misma forma que uno rotativo (ciclo de 7 días anclado al
  día de la semana), para que el resto del código no se bifurque;
- **agrupar** días consecutivos equivalentes en bloques, porque un ciclo de 56 días son 28
  bloques legibles en vez de 56 renglones;
- listar las **jornadas** que un turno usa, que es la superficie que RH configura.

Sobre el ancla: ``TU_RIT_INI`` "vacío" en TRESS es ``1899-12-30``, no NULL. Un turno
rotativo anclado ahí produce una posición de ciclo perfectamente plausible y sin ningún
sentido, sin lanzar error. Por eso se detecta explícitamente en vez de dejarla pasar.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING, Literal

from app.utils.turno_calendario import (
    DiaRitmo,
    EstatusDia,
    TipoTurno,
    TurnoTress,
    coerce_date,
    expandir_patron_rotativo,
    normalizar_codigo,
)

if TYPE_CHECKING:
    from app.models.turnos import Turno

# El "vacío" de TRESS para TU_RIT_INI.
ANCLA_VACIA = date(1899, 12, 30)

_TIPO_DESCANSO = 2

_DIAS_SEMANA = ("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom")

MotivoTurnoInvalido = Literal["PATRON_INVALIDO", "ANCLA_INVALIDA"]


class TurnoCicloError(ValueError):
    """El ciclo del turno no se puede calcular. `motivo` distingue el porqué."""

    def __init__(self, motivo: MotivoTurnoInvalido, detalle: str) -> None:
        super().__init__(detalle)
        self.motivo: MotivoTurnoInvalido = motivo


@dataclass(frozen=True, slots=True)
class BloqueCiclo:
    """Días consecutivos del ciclo que comparten estatus y jornada."""

    dia_inicio: int  # 1-based dentro del ciclo
    dia_fin: int  # inclusivo
    dias: int
    estatus: EstatusDia
    ho_codigo: str | None
    etiqueta: str


def turno_tress_desde_modelo(turno: "Turno") -> TurnoTress:
    """Adapta la fila de `levelup_turnos` a la entrada del motor de rotación."""
    return TurnoTress(
        codigo=normalizar_codigo(turno.tu_codigo),
        rit_pat=turno.tu_rit_pat,
        rit_ini=coerce_date(turno.tu_rit_ini),
        tips=tuple(getattr(turno, f"tu_tip_{i}") for i in range(1, 8)),  # type: ignore[arg-type]
        hors=tuple(getattr(turno, f"tu_hor_{i}") for i in range(1, 8)),  # type: ignore[arg-type]
    )


def tipo_turno(turno: TurnoTress) -> TipoTurno:
    return "ROTATIVO" if turno.es_rotativo else "FIJO"


def ancla_valida(turno: TurnoTress) -> bool:
    """Un rotativo sin ancla real no permite ubicar ninguna fecha en su ciclo."""
    if not turno.es_rotativo:
        return True
    return turno.rit_ini is not None and turno.rit_ini != ANCLA_VACIA


def dias_del_ciclo(turno: TurnoTress) -> list[DiaRitmo]:
    """Los días del ciclo, en orden.

    Rotativo: el ciclo que expande ``FN_GeneraRitmo``. Fijo: los 7 días de la semana
    derivados de ``TU_TIP_1..7`` / ``TU_HOR_1..7``, con lunes en la posición 0 — el mismo
    orden que usa ``date.weekday()``.
    """
    if not turno.es_rotativo:
        return [
            DiaRitmo(
                codigo_horario=(normalizar_codigo(turno.hors[i]) or None)
                if turno.tips[i] != _TIPO_DESCANSO
                else None,
                tipo_dia=turno.tips[i],
            )
            for i in range(7)
        ]

    try:
        return expandir_patron_rotativo(
            turno.rit_pat or "",
            horario1=turno.hors[0],
            horario2=turno.hors[1],
            horario3=turno.hors[2],
        )
    except ValueError as exc:
        # Hay patrones con códigos no numéricos (`2:03S`, `5:001COR`) que el motor no
        # interpreta. Hoy ninguno de esos turnos tiene personal, pero si aparece uno la
        # pantalla debe degradar esa fila, no caerse.
        raise TurnoCicloError("PATRON_INVALIDO", str(exc)) from exc


def longitud_ciclo(turno: TurnoTress) -> int:
    return len(dias_del_ciclo(turno))


def posicion_en_ciclo(turno: TurnoTress, fecha: date) -> int:
    """Índice 0-based de `fecha` dentro del ciclo.

    Para un fijo es el día de la semana. Para un rotativo, la distancia al ancla módulo la
    longitud del ciclo: eso atraviesa fin de semana, cambio de mes y cambio de año sin
    tratamiento especial, y también funciona para fechas anteriores al ancla, porque el
    módulo de Python sobre un negativo devuelve un índice positivo.
    """
    if not turno.es_rotativo:
        return fecha.weekday()
    if not ancla_valida(turno):
        raise TurnoCicloError(
            "ANCLA_INVALIDA",
            f"El turno rotativo {turno.codigo} no tiene fecha de inicio de ciclo válida",
        )
    assert turno.rit_ini is not None  # garantizado por ancla_valida
    return (fecha - turno.rit_ini).days % len(dias_del_ciclo(turno))


def _etiqueta(turno: TurnoTress, inicio: int, fin: int) -> str:
    if not turno.es_rotativo:
        if inicio == fin:
            return _DIAS_SEMANA[inicio]
        return f"{_DIAS_SEMANA[inicio]}–{_DIAS_SEMANA[fin]}"
    if inicio == fin:
        return f"Día {inicio + 1}"
    return f"Días {inicio + 1}–{fin + 1}"


def bloques_del_ciclo(turno: TurnoTress) -> list[BloqueCiclo]:
    """Agrupa días consecutivos con el mismo estatus y jornada.

    No se fusionan el primer bloque con el último aunque coincidan: el ciclo es circular,
    pero "Días 1–2" y "Días 55–56" son dos entradas distintas para quien lo lee.
    """
    ciclo = dias_del_ciclo(turno)
    bloques: list[BloqueCiclo] = []
    inicio = 0

    def clave(dia: DiaRitmo) -> tuple[bool, str | None]:
        descanso = dia.tipo_dia == _TIPO_DESCANSO
        return (descanso, None if descanso else normalizar_codigo(dia.codigo_horario) or None)

    for i in range(1, len(ciclo) + 1):
        if i < len(ciclo) and clave(ciclo[i]) == clave(ciclo[inicio]):
            continue
        descanso, ho_codigo = clave(ciclo[inicio])
        bloques.append(
            BloqueCiclo(
                dia_inicio=inicio + 1,
                dia_fin=i,
                dias=i - inicio,
                estatus="DESCANSO" if descanso else "LABORABLE",
                ho_codigo=ho_codigo,
                etiqueta=_etiqueta(turno, inicio, i - 1),
            )
        )
        inicio = i

    return bloques


def jornadas_del_turno(turno: TurnoTress) -> list[str]:
    """Códigos de jornada que el turno usa en días laborables, en orden de aparición.

    Es la superficie real de configuración: un ciclo de 56 días suele usar 7 jornadas.
    """
    vistas: list[str] = []
    for dia in dias_del_ciclo(turno):
        if dia.tipo_dia == _TIPO_DESCANSO:
            continue
        codigo = normalizar_codigo(dia.codigo_horario)
        if codigo and codigo not in vistas:
            vistas.append(codigo)
    return vistas
