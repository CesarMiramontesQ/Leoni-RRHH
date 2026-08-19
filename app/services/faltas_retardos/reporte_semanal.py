"""Lógica pura del reporte semanal de incidencias en Excel.

Una fila por empleado y una columna por cada una de las tres semanas **anteriores** a
la de la descarga; en cada celda, los códigos de las incidencias de esa semana. Nada de
esto toca la BD: el servicio le pasa la plantilla y los eventos ya leídos, y aquí solo se
arman las semanas y se reparten los códigos. Así el cálculo de semanas —que es donde
están los casos borde (cambio de mes, cambio de año, eventos con rango)— se prueba sin
levantar nada.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable, Mapping

from app.services.faltas_retardos.constants import TIPO_A_CODIGO_REPORTE
from app.utils.business_time import lunes_de_semana_contiene

# Tres semanas, sin la actual: es lo que RH revisa en la junta semanal.
SEMANAS_REPORTE = 3

# Separador dentro de la celda. Las incidencias de una misma semana van juntas en una
# sola celda; nunca abren un renglón nuevo para el empleado.
SEPARADOR_CODIGOS = ", "


@dataclass(frozen=True)
class SemanaReporte:
    """Una de las columnas semanales, ya resuelta a fechas.

    `numero` es la semana ISO (`date.isocalendar()`), la misma convención que ya usan
    horas extra y el mirror FI/RE hacia `importadas_historico`. Se guarda junto con
    `anio` porque en enero la semana 52/53 pertenece al año anterior, y sin el año el
    rango no es reconstruible.
    """

    anio: int
    numero: int
    lunes: date
    domingo: date

    @property
    def etiqueta(self) -> str:
        return f"Semana {self.numero}"


def semanas_previas(hoy: date, cantidad: int = SEMANAS_REPORTE) -> list[SemanaReporte]:
    """Las `cantidad` semanas ISO anteriores a la de `hoy`, de la más vieja a la más nueva.

    Se cuenta restando semanas al lunes de `hoy`, no restando al número de semana: el
    número solo, en enero, daría 0 o negativos, y en el cambio de año la semana anterior
    a la 1 es la 52 o la 53 según el año. Restar sobre la fecha resuelve los dos casos y
    el cambio de mes sin ningún caso especial.
    """
    lunes_actual = lunes_de_semana_contiene(hoy)
    salida: list[SemanaReporte] = []
    for offset in range(max(0, cantidad), 0, -1):
        lunes = lunes_actual - timedelta(weeks=offset)
        anio, numero, _ = lunes.isocalendar()
        salida.append(
            SemanaReporte(
                anio=anio,
                numero=numero,
                lunes=lunes,
                domingo=lunes + timedelta(days=6),
            )
        )
    return salida


def rango_cubierto(semanas: list[SemanaReporte]) -> tuple[date, date] | None:
    """Primer lunes y último domingo: el rango único que se le pide a la caché."""
    if not semanas:
        return None
    return semanas[0].lunes, semanas[-1].domingo


def codigo_de_tipo(tipo: str) -> str | None:
    return TIPO_A_CODIGO_REPORTE.get((tipo or "").strip())


def celdas_por_empleado(
    eventos: Iterable[Mapping],
    semanas: list[SemanaReporte],
) -> dict[int, list[str]]:
    """`{no_empleado: ["FI, RE", "VAC", ""]}`, una entrada por semana en el mismo orden.

    Un evento con rango (incapacidad, suspensión, permiso con goce) aparece **una vez en
    cada semana que toca**, no una por día: es una sola incidencia partida por el
    calendario. Los eventos diarios de `dbo.AUSENCIA` —VAC, FI, RE— ya vienen como una
    fila por día, así que una semana con dos retardos se lee `RE, RE`, tal como los
    cuenta la tabla de la página.
    """
    acumulado: dict[int, dict[int, list[tuple[date, str]]]] = {}
    for evento in eventos:
        no_empleado = evento.get("no_empleado")
        if no_empleado is None:
            continue
        codigo = codigo_de_tipo(str(evento.get("tipo") or ""))
        if codigo is None:
            continue
        inicio = evento.get("fecha_evento")
        if not isinstance(inicio, date):
            continue
        fin = evento.get("fecha_fin")
        fin = fin if isinstance(fin, date) and fin >= inicio else inicio

        for idx, semana in enumerate(semanas):
            if inicio > semana.domingo or fin < semana.lunes:
                continue
            # La entrada del empleado se crea solo si algo cayó dentro: un evento del
            # rango que la caché trajo por solape pero que no toca ninguna de las tres
            # semanas no debe dejar rastro.
            por_semana = acumulado.setdefault(int(no_empleado), {})
            # Ordena por el primer día que el evento ocupa dentro de la semana, para que
            # la celda se lea en el orden en que pasaron las cosas.
            por_semana.setdefault(idx, []).append((max(inicio, semana.lunes), codigo))

    salida: dict[int, list[str]] = {}
    for no_empleado, por_semana in acumulado.items():
        fila = []
        for idx in range(len(semanas)):
            entradas = sorted(por_semana.get(idx, []))
            fila.append(SEPARADOR_CODIGOS.join(codigo for _fecha, codigo in entradas))
        salida[no_empleado] = fila
    return salida
