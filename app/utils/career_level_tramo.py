# app/utils/career_level_tramo.py
"""
Tramo de Global Grades que abarca un Career Level.

Un nivel no tiene orden propio: lo posicionan los grados a los que equivale. Y
no equivale a uno solo — M4 puede abarcar GG17 y GG18 — asi que su posicion es
un **tramo** `[min(orden), max(orden)]`, no un numero.

Consecuencias que este modulo centraliza para que no se reimplementen distinto
en el repo, el servicio de perfiles y el de evaluaciones:

- **Orden**: por el minimo, desempate por el maximo y luego por codigo. Los
  niveles sin equivalencias van al final: no tienen posicion.
- **Cobertura** de un conjunto de niveles: la UNION de los ordenes que abarcan.
  La usa el eje del mapa WTW para recortarse a lo ocupado.

No depende de la sesion: recibe entidades ya cargadas. Quien las pase debe traer
`equivalencias -> global_grade` precargado, o el acceso lazy revienta con
MissingGreenlet.
"""

from __future__ import annotations

from typing import Iterable, Protocol, Sequence


class _ConOrden(Protocol):
    orden: int


class _ConGrade(Protocol):
    global_grade: _ConOrden | None


class _Nivel(Protocol):
    codigo: str
    equivalencias: Sequence[_ConGrade]


def ordenes(grado: _Nivel) -> list[int]:
    """Ordenes de los global grades del nivel, ascendentes y sin repetir."""
    valores = {
        eq.global_grade.orden
        for eq in (grado.equivalencias or [])
        if eq.global_grade is not None
    }
    return sorted(valores)


def tramo(grado: _Nivel) -> tuple[int, int] | None:
    """`[min, max]` de los grados del nivel; None si no tiene equivalencias."""
    valores = ordenes(grado)
    return (valores[0], valores[-1]) if valores else None


def posicion(grado: _Nivel) -> int | None:
    """El extremo inferior del tramo, para lo que solo necesita un numero."""
    t = tramo(grado)
    return t[0] if t else None


def clave_orden(grado: _Nivel) -> tuple[bool, int, int, str]:
    """Clave de ordenacion: sin posicion al final, luego min, max y codigo."""
    t = tramo(grado)
    if t is None:
        return (True, 0, 0, grado.codigo or "")
    return (False, t[0], t[1], grado.codigo or "")


def ordenar(grados: Iterable, clave=None) -> list:
    """
    Ordena por tramo.

    `clave` extrae el nivel cuando lo que se ordena no es el nivel en si, sino
    algo que lo contiene (por ejemplo las filas puente `PuestoPerfilGrado`).
    """
    extraer = clave or (lambda g: g)
    return sorted(grados, key=lambda g: clave_orden(extraer(g)))


def cobertura(grados: Iterable[_Nivel]) -> set[int]:
    """
    Union de los ordenes que cubren los niveles, tramo por tramo.

    Un nivel cubre TODO su tramo, no solo sus extremos: si M4 equivale a GG17 y
    GG19, se considera que tambien pasa por GG18, porque el nivel abarca ese
    espacio aunque RH no haya dado de alta el grado intermedio.
    """
    cubiertos: set[int] = set()
    for g in grados:
        t = tramo(g)
        if t:
            cubiertos.update(range(t[0], t[1] + 1))
    return cubiertos
