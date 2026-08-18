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


def test_sql_base_trae_las_horas_del_retardo():
    """El detalle del retardo necesita hora programada y checada de entrada.

    La entrada de la jornada es `CH_TIPO = 1 AND CH_POSICIO = 1`: sin la posición se
    colaría el regreso de comer, que en TRESS también es una checada de entrada.
    """
    sql = load_faltas_retardos_datos_analisis_sql()
    assert "hora_programada" in sql and "hora_entrada" in sql
    assert "dbo.HORARIO" in sql and "dbo.CHECADAS" in sql
    assert "CH_POSICIO" in sql


def test_sql_base_solo_busca_checada_para_retardos():
    """`CHECADAS` tiene millones de filas; el APPLY no debe correr para otros tipos."""
    sql = load_faltas_retardos_datos_analisis_sql()
    checadas = sql[sql.index("dbo.CHECADAS") : sql.index("dbo.CHECADAS") + 400]
    assert "'RE'" in checadas


def test_normalizar_convierte_las_horas_y_calcula_los_minutos():
    repo = DatosAnalisisFaltasRetardosRepository(MagicMock())
    fila = repo._normalizar(
        {
            "origen": "ausencia",
            "origen_id": 7,
            "no_empleado": 5037,
            "tipo": "retardo",
            "fecha_evento": None,
            "hora_programada": "0600",
            "hora_entrada": "0627",
        }
    )
    assert fila["hora_programada"] == "06:00"
    assert fila["hora_entrada"] == "06:27"
    assert fila["minutos_retardo"] == 27


def test_normalizar_deja_las_horas_en_none_para_los_demas_tipos():
    repo = DatosAnalisisFaltasRetardosRepository(MagicMock())
    fila = repo._normalizar(
        {
            "origen": "permiso",
            "origen_id": 8,
            "no_empleado": 553,
            "tipo": "falta_justificada",
            "fecha_evento": None,
            "hora_programada": None,
            "hora_entrada": None,
        }
    )
    assert fila["hora_programada"] is None
    assert fila["hora_entrada"] is None
    assert fila["minutos_retardo"] is None


def test_la_hora_programada_tambien_se_limita_a_los_retardos():
    """`HO_INTIME` existe para toda la rama A, pero solo el retardo la usa.

    Dejarla en una falta o una incapacidad guardaría en la caché un dato que ninguna
    pantalla muestra y que contradice el contrato de la respuesta.
    """
    sql = load_faltas_retardos_datos_analisis_sql()
    inicio = sql.index("AS hora_programada")
    expresion = sql[sql.rindex("\n", 0, inicio) : inicio]
    assert "'RE'" in expresion
