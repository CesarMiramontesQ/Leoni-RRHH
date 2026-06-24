"""levelup baseline sobre Bono (BD única)

Baseline del esquema propio del proyecto dentro de la BD `Bono`. Asume que
`empleados` y los catálogos (areas, puestos, categorias, subareas,
estados_empleados, clasificacion_empleado) YA existen en Bono (no se tocan).

Crea únicamente las tablas `levelup_*` (incluidas levelup_empleados_core/config/
permisos/horas_extra) con sus índices y FKs a `empleados.empleado_id`, y la vista
de compatibilidad `levelup_vw_empleados`.

Nota de operación: sobre una BD Bono nueva se aplica esta migración de forma
aislada (la cadena previa construía el esquema viejo no prefijado y NO debe
ejecutarse contra Bono; hacer `alembic stamp` hasta esta revisión si es preciso).

Revision ID: v1l2u3p0base
Revises: p2q3r4s5t6u7
Create Date: 2026-06-22

"""
from typing import Sequence, Union

from alembic import op

revision: str = "v1l2u3p0base"
down_revision: Union[str, Sequence[str], None] = "p2q3r4s5t6u7"
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


def _levelup_tables():
    # Import perezoso para registrar todos los modelos en Base.metadata.
    import app.models  # noqa: F401
    from app.core.database import Base

    return [
        t for t in Base.metadata.sorted_tables if t.name.startswith("levelup_")
    ]


_DROP_CROSS_FKS = """
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name LIKE 'levelup_%'
      AND ccu.table_name NOT LIKE 'levelup_%'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
  END LOOP;
END $$;
"""


def upgrade() -> None:
    bind = op.get_bind()
    from app.core.database import Base

    Base.metadata.create_all(bind=bind, tables=_levelup_tables())
    # No acoplar tablas de Bono: quitar FKs de levelup_* que apunten a tablas
    # existentes de Bono (empleados, catálogos). La integridad se valida en app.
    op.execute(_DROP_CROSS_FKS)
    op.execute(_CREATE_VIEW)


def downgrade() -> None:
    op.execute(f"DROP VIEW IF EXISTS {VIEW_NAME}")
    bind = op.get_bind()
    from app.core.database import Base

    for table in reversed(_levelup_tables()):
        Base.metadata.drop_all(bind=bind, tables=[table])
