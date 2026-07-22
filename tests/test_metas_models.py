# tests/test_metas_models.py
"""
Tests de la capa de datos del modulo Metas (OKR ligero).

Cubre: creacion de ciclo/meta/resultados-clave/checkin, orden de resultados
clave via relationship, enlace meta_padre_id a una meta nivel "equipo",
cascade de borrado (ciclo -> metas -> resultados clave -> checkins), y
defaults de estado / autoincrement de id.
"""

from datetime import date
from decimal import Decimal

from app.models.metas import (
    Meta,
    MetaCheckin,
    MetaCiclo,
    MetaResultadoClave,
    META_CICLO_ESTADOS,
    META_ESTADOS,
    META_NIVELES,
    RC_DIRECCIONES,
    RC_TIPOS_METRICA,
)

async def test_ciclo_meta_rc_checkin_y_cascade(db):
    ciclo = MetaCiclo(
        nombre="2026 Q1",
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 3, 31),
        estado="activo",
    )
    db.add(ciclo)
    await db.flush()

    meta = Meta(
        ciclo_id=ciclo.id,
        nivel="individual",
        empleado_id=1,
        titulo="Calidad L3",
        peso=Decimal("40"),
        estado="asignada",
        asignada_por_id=2,
    )
    meta.resultados_clave = [
        MetaResultadoClave(
            orden=2,
            titulo="OPLs",
            tipo_metrica="numero",
            direccion="subir",
            valor_inicial=Decimal("0"),
            valor_objetivo=Decimal("8"),
            valor_actual=Decimal("0"),
        ),
        MetaResultadoClave(
            orden=1,
            titulo="Scrap",
            tipo_metrica="porcentaje",
            direccion="bajar",
            valor_inicial=Decimal("5"),
            valor_objetivo=Decimal("2"),
            valor_actual=Decimal("5"),
        ),
    ]
    db.add(meta)
    await db.flush()

    assert meta.id is not None
    assert ciclo.id is not None

    rc_scrap = next(rc for rc in meta.resultados_clave if rc.titulo == "Scrap")
    rc_opls = next(rc for rc in meta.resultados_clave if rc.titulo == "OPLs")

    checkin = MetaCheckin(
        resultado_clave_id=rc_scrap.id,
        autor_id=1,
        valor_registrado=Decimal("4"),
        nota="Primer avance",
        es_ajuste_jefe=False,
    )
    db.add(checkin)
    await db.flush()

    await db.refresh(ciclo, attribute_names=["metas"])
    await db.refresh(meta, attribute_names=["resultados_clave"])
    await db.refresh(rc_scrap, attribute_names=["checkins"])

    assert len(ciclo.metas) == 1
    assert [rc.titulo for rc in meta.resultados_clave] == ["Scrap", "OPLs"]
    assert len(rc_scrap.checkins) == 1
    assert rc_scrap.checkins[0].nota == "Primer avance"
    assert rc_scrap.checkins[0].es_ajuste_jefe is False

    # Defaults de estado
    assert ciclo.estado == "activo"
    assert meta.estado == "asignada"

    # Enlace meta_padre_id: solo valido apuntando a una meta nivel "equipo"
    meta_equipo = Meta(
        ciclo_id=ciclo.id,
        nivel="equipo",
        area_id=10,
        lider_id=2,
        titulo="Meta de equipo produccion",
        peso=Decimal("100"),
        estado="asignada",
        asignada_por_id=2,
    )
    db.add(meta_equipo)
    await db.flush()

    meta.meta_padre_id = meta_equipo.id
    await db.flush()
    await db.refresh(meta_equipo, attribute_names=["submetas"])

    assert meta.meta_padre_id == meta_equipo.id
    assert meta.meta_padre.id == meta_equipo.id
    assert [sm.id for sm in meta_equipo.submetas] == [meta.id]

    ciclo_id = ciclo.id
    meta_id = meta.id
    meta_equipo_id = meta_equipo.id
    rc_scrap_id = rc_scrap.id
    rc_opls_id = rc_opls.id
    checkin_id = checkin.id

    # Refrescar la coleccion ciclo.metas (meta_equipo se creo despues del
    # ultimo refresh) para que el cascade contemple ambas metas del ciclo.
    await db.refresh(ciclo, attribute_names=["metas"])
    assert len(ciclo.metas) == 2

    # Cascade: borrar el ciclo debe borrar metas -> resultados clave -> checkins
    await db.delete(ciclo)
    await db.flush()

    assert (await db.get(MetaCiclo, ciclo_id)) is None
    assert (await db.get(Meta, meta_id)) is None
    assert (await db.get(Meta, meta_equipo_id)) is None
    assert (await db.get(MetaResultadoClave, rc_scrap_id)) is None
    assert (await db.get(MetaResultadoClave, rc_opls_id)) is None
    assert (await db.get(MetaCheckin, checkin_id)) is None


async def test_meta_ciclo_id_autoincrement_y_defaults(db):
    ciclo1 = MetaCiclo(
        nombre="Ciclo A",
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 6, 30),
    )
    ciclo2 = MetaCiclo(
        nombre="Ciclo B",
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 6, 30),
    )
    db.add_all([ciclo1, ciclo2])
    await db.flush()

    # Default de estado sin especificarlo explicitamente
    assert ciclo1.estado == "borrador"
    assert ciclo2.estado == "borrador"

    # id autoincrement: ambos tienen id asignado y son distintos
    assert ciclo1.id is not None
    assert ciclo2.id is not None
    assert ciclo1.id != ciclo2.id


def test_constantes_de_dominio():
    assert META_CICLO_ESTADOS == ("borrador", "activo", "cerrado")
    assert META_ESTADOS == ("asignada", "en_progreso", "cerrada")
    assert META_NIVELES == ("individual", "equipo")
    assert RC_TIPOS_METRICA == ("numero", "porcentaje", "booleano", "moneda")
    assert RC_DIRECCIONES == ("subir", "bajar")
