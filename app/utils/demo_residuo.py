"""Residuo de catálogo que dejan los seeds demo.

Los seeds crean grupos, tipos y competencias con nombres realistas y sin marcador
(`_get_or_create`), así que no se pueden borrar por patrón. Este módulo centraliza el
criterio: una fila de catálogo solo se retira si ninguna fila viva la referencia. Lo
usan `seed_evaluacion_demo` y `seed_talento_demo`.

Fuera de alcance a propósito: `levelup_grados_puesto` y
`levelup_metodos_calificacion_competencia`. Son catálogo base de la plataforma —los
seeds solo los crean si faltan— y el módulo de competencias deja de funcionar sin ellos.
"""

import logging

from sqlalchemy import func, select

from app.models.evaluacion360 import (
    Eval360CampanaCompetencia,
    Eval360Comentario,
    Eval360PlantillaCompetencia,
    Eval360Pregunta,
    Eval360Respuesta,
    Eval360Resultado,
)
from app.models.talento import (
    Competencia,
    CompetenciaRequisito,
    EvaluacionCompetencia,
    PlanDesarrolloIndividual,
    TipoCompetencia,
)

logger = logging.getLogger(__name__)

REFERENTES_COMPETENCIA = [
    (CompetenciaRequisito, CompetenciaRequisito.competencia_id),
    (EvaluacionCompetencia, EvaluacionCompetencia.competencia_id),
    (PlanDesarrolloIndividual, PlanDesarrolloIndividual.competencia_id),
    (Eval360Pregunta, Eval360Pregunta.competencia_id),
    (Eval360CampanaCompetencia, Eval360CampanaCompetencia.competencia_id),
    (Eval360PlantillaCompetencia, Eval360PlantillaCompetencia.competencia_id),
    (Eval360Respuesta, Eval360Respuesta.competencia_id),
    (Eval360Comentario, Eval360Comentario.competencia_id),
    (Eval360Resultado, Eval360Resultado.competencia_id),
]

REFERENTES_TIPO = [(Competencia, Competencia.tipo_competencia_id)]

REFERENTES_GRUPO = [(TipoCompetencia, TipoCompetencia.grupo_competencia_id)]


async def ids_libres(s, ids: list[int], referentes: list[tuple[type, object]]) -> list[int]:
    """De `ids`, los que ninguna fila viva referencia. Los ocupados se registran."""
    libres: list[int] = []
    for row_id in ids:
        usos: list[str] = []
        for modelo, columna in referentes:
            n = (
                await s.execute(
                    select(func.count()).select_from(modelo).where(columna == row_id)
                )
            ).scalar_one()
            if n:
                usos.append(f"{modelo.__tablename__}={n}")
        if usos:
            logger.warning("Se conserva id=%s: sigue referenciado (%s)", row_id, ", ".join(usos))
        else:
            libres.append(row_id)
    return libres
