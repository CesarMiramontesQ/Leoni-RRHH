"""Sincronización de incidencias: datos-analisis → `levelup_incidencias_tress`.

datos-analisis no existe en el entorno de tests: se mockea el motor y la lectura por
rango (`list_todos`), pero la escritura en Bono es real, así que estos tests cubren el
upsert, la reconciliación de bajas, el reflejo de los eventos locales y la idempotencia
contra la BD.
"""

from datetime import date, timedelta
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app.models.faltas_retardos import FaltaRetardoEvento
from app.models.incidencias_tress import IncidenciaTress
from app.services.sync_incidencias_tress_service import (
    _HORIZONTE_FUTURO_DIAS,
    hasta_efectivo,
    rango_carga_inicial,
    rango_semanas,
    sincronizar_incidencias_tress,
)
from tests.conftest import make_empleado

DESDE = date(2026, 6, 1)
HASTA = date(2026, 7, 31)


def _fila(
    *,
    origen="ausencia",
    origen_id=1,
    no_empleado=553,
    tipo="falta_injustificada",
    fecha_evento=date(2026, 7, 1),
    fecha_fin=None,
    observaciones=None,
    fecha_registro=None,
):
    """Fila tal como la emite el SQL base de datos-analisis."""
    return {
        "origen": origen,
        "origen_id": origen_id,
        "no_empleado": no_empleado,
        "tipo": tipo,
        "fecha_evento": fecha_evento,
        "fecha_fin": fecha_fin,
        "observaciones": observaciones,
        "fecha_registro": fecha_registro,
    }


def _mock_tress(monkeypatch, filas):
    """Motor y repositorio de datos-analisis simulados. Devuelve el repo."""
    engine = AsyncMock()
    engine.dispose = AsyncMock()
    monkeypatch.setattr(
        "app.services.sync_incidencias_tress_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )
    repo = AsyncMock()
    repo.list_todos = AsyncMock(return_value=list(filas))
    monkeypatch.setattr(
        "app.services.sync_incidencias_tress_service."
        "DatosAnalisisFaltasRetardosRepository",
        lambda _engine: repo,
    )
    return repo


async def _filas_cache(db):
    result = await db.execute(
        select(IncidenciaTress).order_by(IncidenciaTress.origen, IncidenciaTress.origen_id)
    )
    return list(result.scalars().all())


@pytest.mark.asyncio
async def test_inserta_filas_nuevas(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(monkeypatch, [_fila(origen_id=1), _fila(origen_id=2, tipo="retardo")])

    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 2
    assert stats.insertados == 2
    assert stats.actualizados == 0
    assert stats.leidos == 2
    # El empleado se resuelve contra Bono.
    assert filas[0].empleado_id == 10


@pytest.mark.asyncio
async def test_empleado_ausente_en_bono_se_guarda_con_empleado_id_nulo(db, monkeypatch):
    _mock_tress(monkeypatch, [_fila(origen_id=1, no_empleado=999999)])

    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 1
    assert filas[0].empleado_id is None
    assert filas[0].no_empleado == 999999


@pytest.mark.asyncio
async def test_resincronizar_al_ausente_en_bono_no_lo_duplica(db, monkeypatch):
    """El sync tiene que seguir *viendo* las filas que la página oculta.

    Las lecturas de la página descartan `empleado_id` NULL, pero `map_existentes` no pasa
    por ese filtro: si lo hiciera, cada corrida creería que la fila no existe, la volvería
    a insertar y reventaría el UNIQUE (origen, origen_id).
    """
    _mock_tress(monkeypatch, [_fila(origen_id=1, no_empleado=999999)])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    _mock_tress(monkeypatch, [_fila(origen_id=1, no_empleado=999999)])
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    assert len(await _filas_cache(db)) == 1
    assert stats.insertados == 0
    assert stats.omitidos == 1


@pytest.mark.asyncio
async def test_dar_de_alta_al_empleado_despues_recupera_sus_incidencias(db, monkeypatch):
    """Alta tardía en Bono: la siguiente corrida estampa el `empleado_id`.

    Es la razón por la que estas filas se ocultan y no se borran.
    """
    _mock_tress(monkeypatch, [_fila(origen_id=1, no_empleado=999999)])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)
    assert (await _filas_cache(db))[0].empleado_id is None

    await make_empleado(db, empleado_id=42, no_empleado=999999, nombre="Tardío")
    _mock_tress(monkeypatch, [_fila(origen_id=1, no_empleado=999999)])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 1
    assert filas[0].empleado_id == 42


@pytest.mark.asyncio
async def test_actualiza_una_fila_corregida_en_tress(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(monkeypatch, [_fila(origen_id=1, tipo="falta_injustificada")])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    # Nómina reclasifica el día: misma LLAVE, otro tipo.
    _mock_tress(monkeypatch, [_fila(origen_id=1, tipo="falta_justificada")])
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 1
    assert filas[0].tipo == "falta_justificada"
    assert stats.actualizados == 1
    assert stats.insertados == 0


@pytest.mark.asyncio
async def test_es_idempotente(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    filas_tress = [_fila(origen_id=1), _fila(origen_id=2, tipo="retardo")]
    _mock_tress(monkeypatch, filas_tress)

    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)
    _mock_tress(monkeypatch, filas_tress)
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    assert len(await _filas_cache(db)) == 2
    assert stats.insertados == 0
    assert stats.actualizados == 0
    assert stats.omitidos == 2


@pytest.mark.asyncio
async def test_borra_lo_que_desaparecio_de_tress_en_el_rango(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(monkeypatch, [_fila(origen_id=1), _fila(origen_id=2, tipo="retardo")])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    # La falta 2 se canceló en nómina.
    _mock_tress(monkeypatch, [_fila(origen_id=1)])
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert [f.origen_id for f in filas] == [1]
    assert stats.eliminados == 1


@pytest.mark.asyncio
async def test_no_borra_nada_si_tress_devuelve_cero_filas(db, monkeypatch):
    """Piso de seguridad: una lectura vacía es más probable que un vaciado real.

    datos-analisis es una réplica de análisis; un ETL recargándola puede contestar sin
    error y con cero filas. Sin este freno, la reconciliación vaciaría la ventana entera
    (o la tabla completa en una carga inicial).
    """
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(monkeypatch, [_fila(origen_id=1), _fila(origen_id=2, tipo="retardo")])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    _mock_tress(monkeypatch, [])
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    assert [f.origen_id for f in await _filas_cache(db)] == [1, 2]
    assert stats.eliminados == 0
    assert stats.errores > 0
    assert "borrado omitido" in stats.mensajes_error[0]


@pytest.mark.asyncio
async def test_no_borra_si_desaparece_mas_de_la_mitad_del_rango(db, monkeypatch):
    """Lectura mutilada: responde, pero le faltan filas. Tampoco se borra."""
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(
        monkeypatch,
        [
            _fila(origen_id=1),
            _fila(origen_id=2, tipo="retardo"),
            _fila(origen_id=3, tipo="falta_justificada"),
        ],
    )
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    # Vuelve solo una de las tres: 2 bajas sobre 3 filas supera el 50%.
    _mock_tress(monkeypatch, [_fila(origen_id=1)])
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    assert [f.origen_id for f in await _filas_cache(db)] == [1, 2, 3]
    assert stats.eliminados == 0
    assert stats.errores > 0
    assert "borrado omitido" in stats.mensajes_error[0]


@pytest.mark.asyncio
async def test_no_borra_fuera_del_rango_sincronizado(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(monkeypatch, [_fila(origen_id=1, fecha_evento=date(2025, 1, 15))])
    await sincronizar_incidencias_tress(
        db, desde=date(2025, 1, 1), hasta=date(2025, 1, 31)
    )

    # Corrida de otro rango: la fila vieja no se toca.
    _mock_tress(monkeypatch, [])
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    assert len(await _filas_cache(db)) == 1
    assert stats.eliminados == 0


@pytest.mark.asyncio
async def test_no_revienta_con_fila_de_tress_que_empieza_antes_del_rango(db, monkeypatch):
    """Una incidencia de rango (incapacidad, suspensión, permiso con goce) puede tener
    `fecha_evento` anterior a `desde` y seguir vigente (`fecha_fin` dentro de la
    ventana). TRESS la vuelve a traer en cada corrida que solapa esa ventana —igual
    criterio que `sql/datos_analisis_faltas_retardos_base.sql`—, así que `map_existentes`
    debe reconocerla como existente o se reinserta y revienta el UNIQUE."""
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    fila_rango = _fila(
        origen="permiso",
        origen_id=200,
        tipo="incapacidad",
        fecha_evento=date(2026, 5, 20),
        fecha_fin=date(2026, 6, 5),
    )
    _mock_tress(monkeypatch, [fila_rango])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    _mock_tress(monkeypatch, [fila_rango])
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 1
    assert stats.insertados == 0
    assert stats.eliminados == 0


@pytest.mark.asyncio
async def test_no_revienta_con_evento_local_que_empieza_antes_del_rango(db, monkeypatch):
    """Mismo defecto, otra fuente: un evento de `levelup_faltas_retardos` con
    `fecha_evento` anterior a `desde` y `fecha_fin` dentro de la ventana.
    `FaltasRetardosRepository.list_levelup_filtered` lo trae por solape en cada corrida
    que toque esa ventana, así que el reflejo `manual` no debe reinsertarse."""
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto")
    db.add(
        FaltaRetardoEvento(
            empleado_id=10,
            tipo="incapacidad_interna",
            fecha_evento=date(2026, 5, 20),
            fecha_fin=date(2026, 6, 5),
            observaciones="reposo prolongado",
            registrado_por_id=11,
        )
    )
    await db.flush()
    _mock_tress(monkeypatch, [])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    _mock_tress(monkeypatch, [])
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 1
    assert filas[0].origen == "manual"
    assert stats.insertados == 0
    assert stats.eliminados == 0


@pytest.mark.asyncio
async def test_refleja_incapacidad_interna_que_solo_vive_en_levelup(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto")
    db.add(
        FaltaRetardoEvento(
            empleado_id=10,
            tipo="incapacidad_interna",
            fecha_evento=date(2026, 7, 10),
            fecha_fin=date(2026, 7, 12),
            observaciones="reposo",
            registrado_por_id=11,
        )
    )
    await db.flush()
    _mock_tress(monkeypatch, [])

    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 1
    assert filas[0].origen == "manual"
    assert filas[0].tipo == "incapacidad_interna"
    assert filas[0].registrado_por_id == 11
    assert filas[0].observaciones == "reposo"


@pytest.mark.asyncio
async def test_estampa_registrado_por_en_la_fila_de_tress_que_empata(db, monkeypatch):
    """Un permiso con goce registrado desde la app existe en TRESS y en levelup."""
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto")
    db.add(
        FaltaRetardoEvento(
            empleado_id=10,
            tipo="matrimonio",
            fecha_evento=date(2026, 7, 20),
            fecha_fin=date(2026, 7, 21),
            observaciones="PERMISO MATRIMONIO",
            registrado_por_id=11,
        )
    )
    await db.flush()
    _mock_tress(
        monkeypatch,
        [
            _fila(
                origen="permiso",
                origen_id=77,
                tipo="matrimonio",
                fecha_evento=date(2026, 7, 20),
                fecha_fin=date(2026, 7, 21),
            )
        ],
    )

    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    # No se duplica: una sola fila, la de TRESS, con la atribución local encima.
    assert len(filas) == 1
    assert filas[0].origen == "permiso"
    assert filas[0].registrado_por_id == 11
    assert filas[0].observaciones == "PERMISO MATRIMONIO"


@pytest.mark.asyncio
async def test_elimina_el_manual_cuando_el_evento_ya_llego_a_tress(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto")
    db.add(
        FaltaRetardoEvento(
            empleado_id=10,
            tipo="defuncion",
            fecha_evento=date(2026, 7, 20),
            fecha_fin=date(2026, 7, 22),
            observaciones="DEFUNCION",
            registrado_por_id=11,
        )
    )
    await db.flush()

    # Primera corrida: TRESS aún no lo tiene → entra como manual.
    _mock_tress(monkeypatch, [])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)
    assert [f.origen for f in await _filas_cache(db)] == ["manual"]

    # Segunda corrida: ya está en TRESS → el manual desaparece.
    _mock_tress(
        monkeypatch,
        [
            _fila(
                origen="permiso",
                origen_id=88,
                tipo="defuncion",
                fecha_evento=date(2026, 7, 20),
                fecha_fin=date(2026, 7, 22),
            )
        ],
    )
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert [f.origen for f in filas] == ["permiso"]
    assert filas[0].registrado_por_id == 11


@pytest.mark.asyncio
async def test_suspension_local_que_empata_conserva_registrado_por(db, monkeypatch):
    """La suspensión sí vive en TRESS; lo que solo vive en levelup es quién la capturó.

    En `main` el listado empataba por (empleado, fecha, tipo) sin filtrar por tipo, así
    que la atribución de una suspensión se veía. La caché tiene que estamparla igual.
    """
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto")
    db.add(
        FaltaRetardoEvento(
            empleado_id=10,
            tipo="suspension",
            fecha_evento=date(2026, 7, 6),
            fecha_fin=date(2026, 7, 8),
            observaciones="ACTA 123",
            registrado_por_id=11,
        )
    )
    await db.flush()
    _mock_tress(
        monkeypatch,
        [
            _fila(
                origen="ausencia",
                origen_id=500,
                tipo="suspension",
                fecha_evento=date(2026, 7, 6),
                fecha_fin=date(2026, 7, 8),
            )
        ],
    )

    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 1
    assert filas[0].origen == "ausencia"
    assert filas[0].registrado_por_id == 11
    assert filas[0].observaciones == "ACTA 123"


@pytest.mark.asyncio
async def test_suspension_local_que_no_empata_no_genera_fila_manual(db, monkeypatch):
    """Solo los tipos con goce entran como `manual`.

    La copia local de una suspensión existe para la atribución, no como renglón propio:
    TRESS la traerá por su cuenta y un `manual` la duplicaría.
    """
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto")
    db.add(
        FaltaRetardoEvento(
            empleado_id=10,
            tipo="suspension",
            fecha_evento=date(2026, 7, 6),
            fecha_fin=date(2026, 7, 8),
            observaciones="ACTA 123",
            registrado_por_id=11,
        )
    )
    await db.flush()
    _mock_tress(monkeypatch, [])

    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    assert await _filas_cache(db) == []
    assert stats.insertados == 0


@pytest.mark.asyncio
async def test_fila_con_fecha_futura_entra_en_la_corrida_del_job(db, monkeypatch):
    """Un permiso capturado por adelantado tiene que entrar antes de que llegue su fecha.

    Con el fin de la ventana en «hoy» no entraba nunca hasta que empezaba, mientras que
    leyendo TRESS en vivo se veía desde que nómina lo insertaba en `dbo.PERMISO`.
    """
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    desde, hasta = rango_semanas(8)
    futuro = date.today() + timedelta(weeks=5)
    assert desde <= futuro <= hasta
    fila_futura = _fila(
        origen="permiso",
        origen_id=900,
        tipo="matrimonio",
        fecha_evento=futuro,
        fecha_fin=futuro + timedelta(days=1),
    )

    _mock_tress(monkeypatch, [fila_futura])
    stats = await sincronizar_incidencias_tress(db, desde=desde, hasta=hasta)
    assert stats.insertados == 1

    # Segunda corrida del mismo rango: ni duplica ni borra.
    _mock_tress(monkeypatch, [fila_futura])
    stats = await sincronizar_incidencias_tress(db, desde=desde, hasta=hasta)

    filas = await _filas_cache(db)
    assert len(filas) == 1
    assert filas[0].fecha_evento == futuro
    assert stats.insertados == 0
    assert stats.eliminados == 0
    assert stats.errores == 0


@pytest.mark.asyncio
async def test_dry_run_no_escribe(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(monkeypatch, [_fila(origen_id=1)])

    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA, execute=False)

    assert stats.insertados == 1
    assert await _filas_cache(db) == []


@pytest.mark.asyncio
async def test_sin_configuracion_de_datos_analisis_no_escribe(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    monkeypatch.setattr(
        "app.services.sync_incidencias_tress_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )

    with pytest.raises(ConnectionError):
        await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    assert await _filas_cache(db) == []


@pytest.mark.asyncio
async def test_error_de_lectura_conserva_el_detalle_del_driver(db, monkeypatch):
    """Solo el nombre de la clase no distingue un timeout de red de uno de permisos."""
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    repo = _mock_tress(monkeypatch, [])
    repo.list_todos = AsyncMock(
        side_effect=OperationalError("stmt", {}, Exception("Login timeout expired"))
    )

    with pytest.raises(ConnectionError, match="Login timeout expired"):
        await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    assert await _filas_cache(db) == []


def test_rango_semanas_arranca_en_lunes_y_llega_al_futuro():
    # 2026-08-06 es jueves; 8 semanas atrás arranca el lunes 2026-06-15.
    desde, hasta = rango_semanas(8, hoy=date(2026, 8, 6))
    assert desde == date(2026, 6, 15)
    assert desde.weekday() == 0
    # El fin no es hoy: lo capturado por adelantado en TRESS también debe entrar.
    assert hasta == date(2026, 8, 6) + timedelta(days=_HORIZONTE_FUTURO_DIAS)


def test_hasta_efectivo_respeta_el_hasta_explicito():
    assert hasta_efectivo(date(2026, 3, 1), date(2026, 8, 6)) == date(2026, 3, 1)
    assert hasta_efectivo(None, date(2026, 8, 6)) == date(2026, 8, 6) + timedelta(
        days=_HORIZONTE_FUTURO_DIAS
    )


def test_rango_carga_inicial_excluye_la_semana_en_curso():
    # Jueves 2026-08-06 → la semana en curso empieza el lunes 2026-08-03,
    # así que la carga inicial llega hasta el domingo 2026-08-02.
    desde, hasta = rango_carga_inicial(hoy=date(2026, 8, 6))
    assert desde is None
    assert hasta == date(2026, 8, 2)


def test_rango_carga_inicial_en_lunes_excluye_ese_lunes():
    desde, hasta = rango_carga_inicial(hoy=date(2026, 8, 3))
    assert desde is None
    assert hasta == date(2026, 8, 2)


def test_carga_inicial_se_hace_en_dos_pasadas_sin_hueco():
    """El histórico no llega al futuro; la segunda pasada sí, y arrancan pegadas.

    Un hueco entre ambas dejaría filas que ninguna corrida lee pero sí reconcilia.
    """
    from app.scripts.sync_incidencias_tress import pasadas_carga_inicial

    pasadas = pasadas_carga_inicial()
    assert [etiqueta for etiqueta, _d, _h in pasadas] == [
        "histórico",
        "ventana viva + futuro",
    ]
    (_, desde_hist, hasta_hist), (_, desde_viva, hasta_viva) = pasadas
    assert desde_hist is None
    assert desde_viva <= hasta_hist + timedelta(days=1)
    assert hasta_viva > date.today()
