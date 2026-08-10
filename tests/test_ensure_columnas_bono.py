"""La lista de columnas externas debe cubrir lo que el INSERT de Bono escribe.

El fallo que esto previene: alguien agrega una columna al INSERT de
`importadas_historico` y no la declara en `ensure_columnas_bono`. En dev funciona
—porque ahí la columna se creó a mano— y revienta en producción tras el deploy.
"""

import re
from pathlib import Path

from app.scripts.ensure_columnas_bono import COLUMNAS_REQUERIDAS

# Columnas de importadas_historico que ya existen en el esquema de Bono desde antes de
# este proyecto: no las creamos nosotros y no deben estar en la lista.
_COLUMNAS_ORIGINALES = {
    "no_empleado",
    "tipo_inc",
    "inc_id",
    "id_semana",
    "area_empleado",
    "subarea_empleado",
    "fecha_incidencia",
    "fecha_registro",
}


def _columnas_del_insert() -> set[str]:
    fuente = Path("app/repositories/bono_importadas_historico_repository.py").read_text(
        encoding="utf-8"
    )
    bloque = re.search(
        r"columnas = \[(.*?)\]", fuente, re.DOTALL
    )
    assert bloque is not None, "no se encontró la lista de columnas del INSERT"
    return set(re.findall(r'\("(\w+)",', bloque.group(1)))


def test_lista_cubre_las_columnas_nuevas_del_insert():
    declaradas = {
        c.columna for c in COLUMNAS_REQUERIDAS if c.tabla == "importadas_historico"
    }
    del_insert = _columnas_del_insert()
    nuevas = del_insert - _COLUMNAS_ORIGINALES

    assert nuevas <= declaradas, (
        "El INSERT escribe columnas que ensure_columnas_bono no asegura: "
        f"{sorted(nuevas - declaradas)}. Decláralas ahí o el deploy fallará."
    )


def test_solo_columnas_aditivas_y_nullables():
    """Nada de NOT NULL ni defaults: la tabla es de Bono y ya tiene datos."""
    for col in COLUMNAS_REQUERIDAS:
        tipo = col.tipo.lower()
        assert "not null" not in tipo, col
        assert "default" not in tipo, col
        assert col.motivo, f"{col.tabla}.{col.columna} sin motivo documentado"


def test_no_declara_columnas_del_esquema_original():
    """Solo se aseguran columnas que agregó este proyecto, no las de Bono."""
    declaradas = {
        c.columna for c in COLUMNAS_REQUERIDAS if c.tabla == "importadas_historico"
    }
    assert not (declaradas & _COLUMNAS_ORIGINALES)
