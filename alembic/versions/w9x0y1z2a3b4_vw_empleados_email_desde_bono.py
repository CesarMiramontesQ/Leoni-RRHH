"""levelup_vw_empleados: email desde empleados (Bono)

Revision ID: w9x0y1z2a3b4
Revises: 37a743fada1c
Create Date: 2026-06-24

La vista de compatibilidad debe exponer el correo de empleados.email, no de
levelup_empleados_core.email.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "w9x0y1z2a3b4"
down_revision: Union[str, None] = "37a743fada1c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VIEW_NAME = "levelup_vw_empleados"

_CREATE_VIEW = f"""
CREATE OR REPLACE VIEW {VIEW_NAME} AS
SELECT
    e.empleado_id,
    e.no_empleado,
    e.no_sap,
    e.nombre,
    e.usuario,
    e.estado_id,
    e.area_id,
    e.puesto_id,
    e.categoria_id,
    e.subarea_id,
    e.clasificacion_id,
    e.centrocosto_id,
    e.foto,
    e.lider_id,
    e.recibe_bono,
    e.brigada,
    e.registro,
    e.a_restringido,
    e.requiere_cambio_password,
    c.rol_id,
    c.password_hash,
    CAST(e.email AS character varying(255)) AS email,
    c.created_at,
    cfg.fecha_fin_contrato,
    cfg.modulos_rh,
    cfg.inscrito_modulos_rh,
    cfg.acceso_rh_removido,
    p.puede_administrar_permisos_rh,
    p.puede_registrar_horas_extra,
    he.autorizado_en          AS horas_extra_autorizado_en,
    he.autorizado_por_empleado_id AS horas_extra_autorizado_por_empleado_id
FROM empleados e
LEFT JOIN levelup_empleados_core         c   ON c.empleado_id   = e.empleado_id
LEFT JOIN levelup_empleados_config       cfg ON cfg.empleado_id = e.empleado_id
LEFT JOIN levelup_empleados_permisos     p   ON p.empleado_id   = e.empleado_id
LEFT JOIN levelup_empleados_horas_extra  he  ON he.empleado_id  = e.empleado_id
"""

# Vista anterior (rollback): email desde levelup_empleados_core.
_REVERT_VIEW = f"""
CREATE OR REPLACE VIEW {VIEW_NAME} AS
SELECT
    e.empleado_id,
    e.no_empleado,
    e.no_sap,
    e.nombre,
    e.usuario,
    e.estado_id,
    e.area_id,
    e.puesto_id,
    e.categoria_id,
    e.subarea_id,
    e.clasificacion_id,
    e.centrocosto_id,
    e.foto,
    e.lider_id,
    e.recibe_bono,
    e.brigada,
    e.registro,
    e.a_restringido,
    e.requiere_cambio_password,
    c.rol_id,
    c.password_hash,
    c.email,
    c.created_at,
    cfg.fecha_fin_contrato,
    cfg.modulos_rh,
    cfg.inscrito_modulos_rh,
    cfg.acceso_rh_removido,
    p.puede_administrar_permisos_rh,
    p.puede_registrar_horas_extra,
    he.autorizado_en          AS horas_extra_autorizado_en,
    he.autorizado_por_empleado_id AS horas_extra_autorizado_por_empleado_id
FROM empleados e
LEFT JOIN levelup_empleados_core         c   ON c.empleado_id   = e.empleado_id
LEFT JOIN levelup_empleados_config       cfg ON cfg.empleado_id = e.empleado_id
LEFT JOIN levelup_empleados_permisos     p   ON p.empleado_id   = e.empleado_id
LEFT JOIN levelup_empleados_horas_extra  he  ON he.empleado_id  = e.empleado_id
"""


def upgrade() -> None:
    op.execute(_CREATE_VIEW)


def downgrade() -> None:
    op.execute(_REVERT_VIEW)
