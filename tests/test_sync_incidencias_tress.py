"""Sincronización de incidencias: datos-analisis → `levelup_incidencias_tress`.

datos-analisis no existe en el entorno de tests: se mockea el motor y la lectura por
rango (`list_todos`), pero la escritura en Bono es real, así que estos tests cubren el
upsert, la reconciliación de bajas, el reflejo de los eventos locales y la idempotencia
contra la BD.
"""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.models.faltas_retardos import FaltaRetardoEvento
from app.models.incidencias_tress import IncidenciaTress
from app.services.sync_incidencias_tress_service import (
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


def test_rango_semanas_arranca_en_lunes():
    # 2026-08-06 es jueves; 8 semanas atrás arranca el lunes 2026-06-15.
    desde, hasta = rango_semanas(8, hoy=date(2026, 8, 6))
    assert desde == date(2026, 6, 15)
    assert desde.weekday() == 0
    assert hasta == date(2026, 8, 6)


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
