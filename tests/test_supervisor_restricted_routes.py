"""Política del middleware de rutas restringidas para supervisores."""

from app.middleware.supervisor_restricted_routes import supervisor_restricted_path_allowed


def test_supervisor_admin_operativo_puede_actas():
    payload = {"rol": "supervisor", "rh_admin": True, "type": "access"}
    assert supervisor_restricted_path_allowed(
        payload,
        "/api/v1/actas/metricas-dashboard",
        rh_ui_mode="operativo",
    )


def test_supervisor_admin_lider_bloqueado_actas():
    payload = {"rol": "supervisor", "rh_admin": True, "type": "access"}
    assert not supervisor_restricted_path_allowed(
        payload,
        "/api/v1/actas/metricas-dashboard",
        rh_ui_mode="lider",
    )


def test_supervisor_inscrito_con_modulo_actas():
    payload = {
        "rol": "supervisor",
        "type": "access",
        "rh_enrolled": True,
        "rh_modulos": {"actas": True, "dashboard": True},
    }
    assert supervisor_restricted_path_allowed(
        payload,
        "/api/v1/actas/metricas-dashboard",
    )


def test_supervisor_sin_modulo_bloqueado():
    payload = {
        "rol": "supervisor",
        "type": "access",
        "rh_enrolled": True,
        "rh_modulos": {"dashboard": True},
    }
    assert not supervisor_restricted_path_allowed(
        payload,
        "/api/v1/actas/metricas-dashboard",
    )
