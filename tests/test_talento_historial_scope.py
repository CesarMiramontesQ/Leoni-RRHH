"""`indice_equipo_con_scope` recibe los ids ya resueltos (lo que necesita el
Dashboard de Talento) y conserva las mismas protecciones de rango que la
version publica."""
from datetime import date

import pytest

from app.core.exceptions import DomainValidationError
from app.services.historial_objetivo_service import HistorialObjetivoService


@pytest.mark.asyncio
async def test_con_scope_universo_exige_rango(db):
    """Sin scope y sin rango, agregaria toda la organizacion sin acotar."""
    svc = HistorialObjetivoService(db)
    with pytest.raises(DomainValidationError):
        await svc.indice_equipo_con_scope(None, None, None)


@pytest.mark.asyncio
async def test_con_scope_acotado_no_exige_rango(db):
    """Con scope de equipo la consulta ya esta acotada por empleado: no se
    exige rango de fechas (a diferencia del universo sin scope) y el ranking
    cubre a todo el equipo, aunque no tenga eventos en el periodo (mismo
    comportamiento que `indice_equipo`, ver
    `test_indice_equipo_supervisor_sin_rango_de_fechas_sigue_funcionando`)."""
    svc = HistorialObjetivoService(db)
    resp = await svc.indice_equipo_con_scope([1, 2], None, None)
    assert {item.empleado_id for item in resp.items} == {1, 2}


@pytest.mark.asyncio
async def test_con_scope_valida_rango_invertido(db):
    svc = HistorialObjetivoService(db)
    with pytest.raises(DomainValidationError):
        await svc.indice_equipo_con_scope([1], date(2026, 5, 1), date(2026, 1, 1))
