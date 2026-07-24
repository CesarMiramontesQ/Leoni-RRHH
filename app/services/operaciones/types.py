"""Estructuras de datos de la agregacion de cobertura (sin Pydantic ni DB)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CompetenciaMeta:
    competencia_id: int
    nombre: str
    tipo_nombre: str


@dataclass
class EmpleadoCompetencias:
    empleado_id: int
    no_empleado: int | str
    nombre: str
    puesto_perfil_id: int
    puesto_nombre: str
    # comp_id -> (nivel_actual, nivel_requerido); solo competencias con nivel_requerido >= 1.
    competencias: dict[int, tuple[int, int]]


@dataclass
class CoberturaCompetencia:
    competencia_id: int
    competencia_nombre: str
    tipo_nombre: str
    requieren: int
    cubren: int
    en_entrenamiento: int
    cobertura_pct: float
    semaforo: str   # "verde" | "ambar" | "rojo"
    severidad: str  # "ok" | "punto_unico" | "hueco"


@dataclass
class CandidatoCrossTrain:
    empleado_id: int
    no_empleado: int | str
    nombre: str
    nivel_actual: int
    nivel_requerido: int
