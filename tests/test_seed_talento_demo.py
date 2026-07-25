"""Tests de las funciones puras del seed demo de Talento.

Sin BD, igual que `tests/test_seed_comedor_accesos_demo.py`: lo que se protege
aqui es el marcado (de el depende que `--cleanup` no borre datos reales) y el
reparto de niveles, que es lo que hace que la demo tenga los tres estados de
cobertura en vez de un porcentaje plano.
"""

from app.utils.seed_talento_demo import (
    DEMO_CODIGO_PREFIJO,
    DEMO_NOMBRE_PREFIJO,
    demo,
    es_demo_codigo,
    es_demo_nombre,
    nivel_evaluado,
)


class TestMarcadores:
    def test_reconoce_lo_propio(self):
        assert es_demo_codigo(f"{DEMO_CODIGO_PREFIJO}011")
        assert es_demo_nombre(demo("Crimpado manual"))
        assert demo("x").startswith(DEMO_NOMBRE_PREFIJO)

    def test_no_reclama_datos_reales(self):
        # Si esto fallara, `--cleanup` borraria produccion.
        assert not es_demo_codigo("PRF-2026-001")
        assert not es_demo_nombre("Induccion de seguridad")
        assert not es_demo_nombre("Curso [DEMO] intercalado")  # el prefijo va al inicio
        assert not es_demo_codigo(None)
        assert not es_demo_nombre(None)
        assert not es_demo_codigo("")


class TestNivelEvaluado:
    def _cobertura(self, i_competencia: int, n_empleados: int, nivel_requerido: int) -> int:
        return sum(
            1
            for i in range(n_empleados)
            if nivel_evaluado(i_competencia, i, nivel_requerido) >= nivel_requerido
        )

    def test_las_tres_severidades_de_operaciones(self):
        """Cada puesto debe producir cobertura ok, punto unico y hueco."""
        n = 10
        assert self._cobertura(0, n, 3) == n          # todos cubren -> ok / verde
        assert self._cobertura(1, n, 3) == n // 2     # la mitad -> ok
        assert self._cobertura(2, n, 3) == 1          # punto_unico
        assert self._cobertura(3, n, 3) == 0          # hueco

    def test_nunca_devuelve_cero_ni_pasa_de_cuatro(self):
        # 0 significaria "sin evaluar"; aqui todos los pares estan evaluados.
        for i_comp in range(6):
            for i_emp in range(12):
                for requerido in (1, 2, 3, 4):
                    nivel = nivel_evaluado(i_comp, i_emp, requerido)
                    assert 1 <= nivel <= 4

    def test_quien_no_cumple_queda_en_entrenamiento_no_en_cero(self):
        """Un nivel por debajo del requisito cuenta como 'en entrenamiento' en
        la cobertura; en 0 seria 'sin nivel' y la columna se leeria distinto."""
        assert nivel_evaluado(3, 0, 3) == 2
        assert nivel_evaluado(3, 5, 4) == 3

    def test_es_deterministico(self):
        assert nivel_evaluado(2, 7, 3) == nivel_evaluado(2, 7, 3)
