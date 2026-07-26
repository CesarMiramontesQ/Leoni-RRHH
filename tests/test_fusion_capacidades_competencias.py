"""Fusion del permiso `capacidades` dentro de `competencias`.

Una migracion de permisos que se equivoque otorga o quita accesos a gente real,
asi que la transformacion se prueba aparte de `alembic upgrade`, y ademas se
comprueba el efecto de punta a punta: que la pantalla de multihabilidades siga
abriendose con la clave que queda y con la vieja.
"""

import pytest

from app.core.rh_module_registry import (
    all_module_keys,
    effective_modules,
    nav_item_to_module_key,
    resolve_module_from_hash,
)
from app.utils.modulos_rh_migracion import (
    fusionar_capacidades_en_competencias,
    revertir_fusion,
)
from tests.conftest import auth_headers, make_empleado


class TestTransformacion:
    def test_quien_solo_tenia_la_matriz_no_pierde_acceso(self):
        nuevos, cambio = fusionar_capacidades_en_competencias(
            {"capacidades": True, "competencias": False}
        )
        assert cambio is True
        assert nuevos == {"competencias": True}

    def test_quien_tenia_ambas_queda_igual(self):
        nuevos, _ = fusionar_capacidades_en_competencias(
            {"capacidades": True, "competencias": True, "puestos": True}
        )
        assert nuevos == {"competencias": True, "puestos": True}

    def test_no_otorga_a_quien_no_tenia_nada(self):
        nuevos, cambio = fusionar_capacidades_en_competencias(
            {"capacidades": False, "competencias": False}
        )
        assert cambio is True
        assert nuevos == {"competencias": False}

    def test_no_toca_dicts_sin_la_clave(self):
        nuevos, cambio = fusionar_capacidades_en_competencias({"puestos": True})
        assert cambio is False
        assert nuevos == {"puestos": True}

    def test_dict_vacio_significa_acceso_completo_y_se_respeta(self):
        # `effective_modules({})` = todos los modulos. Si la migracion metiera
        # aqui `competencias: False`, le quitaria TODO lo demas a ese usuario.
        assert fusionar_capacidades_en_competencias({}) == ({}, False)
        assert fusionar_capacidades_en_competencias(None) == ({}, False)
        assert effective_modules({})["puestos"] is True

    def test_reversa_repone_la_clave_con_el_valor_combinado(self):
        fusionado, _ = fusionar_capacidades_en_competencias(
            {"capacidades": True, "competencias": False}
        )
        revertido, cambio = revertir_fusion(fusionado)
        assert cambio is True
        assert revertido == {"competencias": True, "capacidades": True}

    def test_ida_y_vuelta_no_quita_accesos(self):
        original = {"capacidades": True, "competencias": True, "metas": False}
        fusionado, _ = fusionar_capacidades_en_competencias(original)
        revertido, _ = revertir_fusion(fusionado)
        for clave, valor in original.items():
            if valor:
                assert revertido.get(clave) is True


class TestRegistro:
    def test_capacidades_deja_de_ser_una_clave_propia(self):
        assert "capacidades" not in all_module_keys()

    def test_la_pantalla_y_su_api_resuelven_al_modulo_que_queda(self):
        assert resolve_module_from_hash("#/capacidades") == "competencias"
        assert resolve_module_from_hash("#/competencias") == "competencias"
        assert nav_item_to_module_key("capacidades") == "competencias"

    def test_un_token_ya_emitido_con_la_clave_vieja_sigue_dando_acceso(self):
        # Sin este alias, todo el que tuviera `capacidades` se quedaria fuera
        # hasta su siguiente login, aunque la BD ya estuviera migrada.
        assert effective_modules({"capacidades": True})["competencias"] is True


@pytest.mark.asyncio
async def test_multihabilidades_se_abre_con_el_modulo_competencias(client, db):
    """El endpoint de la matriz cuelga de /api/v1/competencias, asi que el
    guard por prefijo de ruta exige ahora esa clave."""
    rh = await make_empleado(
        db,
        rol="rh",
        email="fusion_comp@leoni.test",
        modulos_rh={"competencias": True},
        inscrito_modulos_rh=True,
    )
    headers = await auth_headers(client, rh)
    resp = await client.get(
        "/api/v1/competencias/multihabilidades/puestos", headers=headers
    )
    assert resp.status_code != 403, resp.text


@pytest.mark.asyncio
async def test_multihabilidades_sigue_abriendose_con_la_clave_vieja(client, db):
    rh = await make_empleado(
        db,
        rol="rh",
        email="fusion_legacy@leoni.test",
        modulos_rh={"capacidades": True},
        inscrito_modulos_rh=True,
    )
    headers = await auth_headers(client, rh)
    resp = await client.get(
        "/api/v1/competencias/multihabilidades/puestos", headers=headers
    )
    assert resp.status_code != 403, resp.text
