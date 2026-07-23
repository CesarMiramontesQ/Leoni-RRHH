"""Tests del modulo Manejo de OPLs."""
from app.schemas.level_up import (
    OPLConVersionesResponse,
    OPLVersionAgregar,
    OPLVersionItem,
)


def test_schemas_opl_existen():
    assert "versiones" in OPLConVersionesResponse.model_fields
    assert "version_actual" in OPLConVersionesResponse.model_fields
    assert "total_versiones" in OPLConVersionesResponse.model_fields
    assert "aprobador_nombre" in OPLConVersionesResponse.model_fields
    v = OPLVersionAgregar(archivo_url="http://x/y.pdf")
    assert v.cambios_descripcion is None
    assert "creado_por_nombre" in OPLVersionItem.model_fields
