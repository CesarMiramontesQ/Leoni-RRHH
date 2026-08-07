"""SQL builder de `DatosAnalisisFaltasRetardosRepository` (lectura de TRESS).

La página Incidencias ya no lee este repositorio en vivo (ver
`tests/test_faltas_retardos_datos_analisis.py`, que ejercita la caché en Bono); pero el
módulo sigue vivo: es el que usa `sync_incidencias_tress_service` (el sync semanal) para
leer `dbo.AUSENCIA` + `dbo.PERMISO`. Estos tests cubren su SQL sin abrir ninguna BD.
"""

from unittest.mock import MagicMock

from sqlalchemy import text

from app.repositories.datos_analisis_faltas_retardos_repository import (
    DatosAnalisisFaltasRetardosRepository,
    cb_codigos_a_csv,
    load_faltas_retardos_datos_analisis_sql,
)


def test_sql_base_tiene_exactamente_tres_binds():
    """Un ':token' en un comentario se volvería bind y rompería la consulta."""
    parsed = text(load_faltas_retardos_datos_analisis_sql())
    assert set(parsed._bindparams.keys()) == {"fecha_inicio", "fecha_fin", "cb_codigos_csv"}


def test_sql_base_no_termina_en_punto_y_coma():
    """Se envuelve como tabla derivada; un ';' lo rompería."""
    assert not load_faltas_retardos_datos_analisis_sql().rstrip().endswith(";")


def test_sql_base_cubre_las_dos_ramas():
    sql = load_faltas_retardos_datos_analisis_sql()
    assert "dbo.AUSENCIA" in sql and "dbo.PERMISO" in sql and "UNION ALL" in sql
    # Los tipos con goce se distinguen por el comentario, ignorando acentos.
    assert "Latin1_General_CI_AI" in sql


def test_cb_codigos_a_csv_ordena_y_deduplica():
    assert cb_codigos_a_csv([30, 10, 10, 20]) == "10,20,30"
    assert cb_codigos_a_csv([]) == ""
    assert cb_codigos_a_csv(None) is None


def test_repo_filtra_por_tipo_con_un_solo_bind():
    repo = DatosAnalisisFaltasRetardosRepository(MagicMock())
    assert ":tipo" in repo._filtrado()
