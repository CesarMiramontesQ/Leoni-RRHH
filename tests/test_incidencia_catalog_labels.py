from app.utils.incidencia_catalog_labels import IncidenciaCatalogLabelMaps


def _maps() -> IncidenciaCatalogLabelMaps:
    return IncidenciaCatalogLabelMaps(
        area_by_id={10: "Calidad", 4: "Almacen"},
        subarea_by_id={7: "Linea A", 12: "Inspeccion"},
    )


def test_resolve_area_numeric_id():
    maps = _maps()
    assert maps.resolve_area("10") == "Calidad"
    assert maps.resolve_area("99") == "99"


def test_distinct_resolved_areas_dedupes_id_and_name():
    maps = _maps()
    out = maps.distinct_resolved_areas(["10", "Calidad", "4", "Almacen"])
    assert out == ["Almacen", "Calidad"]


def test_aliases_for_area_filter_includes_id_and_name():
    maps = _maps()
    assert maps.aliases_for_area_filter("Calidad") == ["10", "Calidad"]
    assert maps.aliases_for_area_filter("10") == ["10", "Calidad"]


def test_merge_area_totals_combines_numeric_and_named():
    maps = _maps()
    merged = maps.merge_area_totals([("10", 3), ("Calidad", 2), ("4", 1)])
    assert merged == [("Calidad", 5), ("Almacen", 1)]


def test_resolve_area_id_from_name_or_numeric():
    maps = _maps()
    assert maps.resolve_area_id("Calidad") == 10
    assert maps.resolve_area_id("10") == 10
    assert maps.resolve_area_id("Desconocida") is None
