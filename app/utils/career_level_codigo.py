# app/utils/career_level_codigo.py
"""
Regla del codigo de un Career Level: el codigo de su Career Path + un numero.

Bajo el path `P` los niveles son `P1`, `P10`; bajo `M`, `M1`. Asi el codigo dice
a que path pertenece el nivel sin abrir el registro, que es lo que la
nomenclatura Towers busca. El codigo es ademas la etiqueta con la que el nivel
aparece en el rango de un perfil (`P10 -> P12`), en la matriz de competencias y
en el historial de clasificacion.

Modulo de reglas puro (sin BD) para poder probarlo aparte del servicio.
`frontend/src/talento/clasificacionPuestoUi.ts` es su espejo en el cliente.
"""

from __future__ import annotations

import re

# Limite de `levelup_grados_puesto.codigo`.
MAX_LONGITUD_CODIGO = 10

# Un entero >= 1 sin ceros a la izquierda: 'P01' seria ambiguo con 'P1'.
_NUMERO = re.compile(r"[1-9]\d*")


def _partir(prefijo: str, codigo: str) -> str | None:
    """Devuelve la parte numerica si `codigo` cumple la regla; None si no."""
    prefijo = (prefijo or "").strip()
    codigo = (codigo or "").strip()
    if not prefijo or len(codigo) <= len(prefijo):
        return None
    if codigo[: len(prefijo)].casefold() != prefijo.casefold():
        return None
    resto = codigo[len(prefijo) :]
    return resto if _NUMERO.fullmatch(resto) else None


def numero_de(prefijo: str, codigo: str) -> int | None:
    """El numero de un codigo que cumple la regla; None si no la cumple."""
    resto = _partir(prefijo, codigo)
    return int(resto) if resto is not None else None


def normalizar_codigo(prefijo: str, codigo: str) -> str:
    """
    Valida `codigo` contra `prefijo` y devuelve su forma canonica.

    El prefijo se compara sin distinguir mayusculas pero se almacena con el
    codigo exacto del career path: capturar 'p10' bajo el path 'P' guarda 'P10'.

    Lanza `ValueError` con un mensaje ya redactado para el usuario.
    """
    prefijo = (prefijo or "").strip()
    resto = _partir(prefijo, codigo)
    if resto is None:
        raise ValueError(
            f"debe ser '{prefijo}' seguido de un numero "
            f"({prefijo}1, {prefijo}10). Recibido: '{(codigo or '').strip()}'"
        )

    canonico = f"{prefijo}{resto}"
    if len(canonico) > MAX_LONGITUD_CODIGO:
        raise ValueError(
            f"'{canonico}' excede los {MAX_LONGITUD_CODIGO} caracteres del codigo. "
            f"El prefijo '{prefijo}' deja poco espacio para el numero"
        )
    return canonico


def siguiente_numero(prefijo: str, codigos: list[str]) -> int:
    """Primer numero por encima del mayor en uso; 1 si no hay ninguno valido."""
    numeros = [n for n in (numero_de(prefijo, c) for c in codigos) if n is not None]
    return max(numeros) + 1 if numeros else 1
