"""modulo horas extra — tablas, vistas y triggers

Revision ID: h1e2x3t4r5a6
Revises: 9da74a4d3527, e7f8g9h0i1j2
Create Date: 2026-06-10
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "h1e2x3t4r5a6"
down_revision: Union[str, tuple[str, ...], None] = ("9da74a4d3527", "e7f8g9h0i1j2")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

HORAS_EXTRA_TIPO_ENUM = postgresql.ENUM(
    "planeado", "espontaneo", name="horas_extra_tipo_enum", create_type=False
)
HORAS_EXTRA_ESTADO_ENUM = postgresql.ENUM(
    "borrador",
    "pendiente",
    "aprobado",
    "rechazado",
    "cancelado",
    name="horas_extra_estado_enum",
    create_type=False,
)
HORAS_EXTRA_TIPO_FIRMA_ENUM = postgresql.ENUM(
    "gerente_area",
    "gerente_regional",
    "director_planta",
    name="horas_extra_tipo_firma_enum",
    create_type=False,
)
HORAS_EXTRA_APROBACION_ESTADO_ENUM = postgresql.ENUM(
    "pendiente",
    "aprobado",
    "rechazado",
    name="horas_extra_aprobacion_estado_enum",
    create_type=False,
)


def upgrade() -> None:
    HORAS_EXTRA_TIPO_ENUM.create(op.get_bind(), checkfirst=True)
    HORAS_EXTRA_ESTADO_ENUM.create(op.get_bind(), checkfirst=True)
    HORAS_EXTRA_TIPO_FIRMA_ENUM.create(op.get_bind(), checkfirst=True)
    HORAS_EXTRA_APROBACION_ESTADO_ENUM.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "centros_costo",
        sa.Column("centrocosto_id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(length=30), nullable=False),
        sa.Column("descripcion", sa.String(length=200), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.PrimaryKeyConstraint("centrocosto_id"),
        sa.UniqueConstraint("codigo"),
    )

    op.create_table(
        "horas_extra_motivos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("codigo", sa.String(length=30), nullable=False),
        sa.Column("descripcion", sa.String(length=255), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo"),
    )

    op.create_table(
        "horas_extra_solicitudes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fecha_solicitud", sa.Date(), nullable=False),
        sa.Column("semana_inicio", sa.Date(), nullable=False),
        sa.Column("tipo", HORAS_EXTRA_TIPO_ENUM, nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("subarea_id", sa.Integer(), nullable=False),
        sa.Column("centrocosto_id", sa.Integer(), nullable=False),
        sa.Column("motivo_id", sa.Integer(), nullable=False),
        sa.Column("comentarios", sa.Text(), nullable=True),
        sa.Column(
            "estado",
            HORAS_EXTRA_ESTADO_ENUM,
            server_default="pendiente",
            nullable=False,
        ),
        sa.Column("registrado_por_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "EXTRACT(ISODOW FROM semana_inicio) = 1",
            name="chk_horas_extra_semana_lunes",
        ),
        sa.ForeignKeyConstraint(["area_id"], ["areas.area_id"]),
        sa.ForeignKeyConstraint(["subarea_id"], ["subareas.subarea_id"]),
        sa.ForeignKeyConstraint(["centrocosto_id"], ["centros_costo.centrocosto_id"]),
        sa.ForeignKeyConstraint(["motivo_id"], ["horas_extra_motivos.id"]),
        sa.ForeignKeyConstraint(["registrado_por_id"], ["empleados.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "horas_extra_solicitud_detalle",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("solicitud_id", sa.Integer(), nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("lunes", sa.Numeric(5, 2), server_default="0", nullable=False),
        sa.Column("martes", sa.Numeric(5, 2), server_default="0", nullable=False),
        sa.Column("miercoles", sa.Numeric(5, 2), server_default="0", nullable=False),
        sa.Column("jueves", sa.Numeric(5, 2), server_default="0", nullable=False),
        sa.Column("viernes", sa.Numeric(5, 2), server_default="0", nullable=False),
        sa.Column("sabado", sa.Numeric(5, 2), server_default="0", nullable=False),
        sa.Column("domingo", sa.Numeric(5, 2), server_default="0", nullable=False),
        sa.Column(
            "total_horas",
            sa.Numeric(6, 2),
            sa.Computed(
                "lunes + martes + miercoles + jueves + viernes + sabado + domingo",
                persisted=True,
            ),
            nullable=False,
        ),
        sa.CheckConstraint("lunes >= 0", name="chk_he_detalle_lunes_nonneg"),
        sa.CheckConstraint("martes >= 0", name="chk_he_detalle_martes_nonneg"),
        sa.CheckConstraint("miercoles >= 0", name="chk_he_detalle_miercoles_nonneg"),
        sa.CheckConstraint("jueves >= 0", name="chk_he_detalle_jueves_nonneg"),
        sa.CheckConstraint("viernes >= 0", name="chk_he_detalle_viernes_nonneg"),
        sa.CheckConstraint("sabado >= 0", name="chk_he_detalle_sabado_nonneg"),
        sa.CheckConstraint("domingo >= 0", name="chk_he_detalle_domingo_nonneg"),
        sa.ForeignKeyConstraint(
            ["solicitud_id"],
            ["horas_extra_solicitudes.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("solicitud_id", "empleado_id", name="uq_he_detalle_solicitud_empleado"),
    )

    op.create_table(
        "horas_extra_aprobaciones",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("solicitud_id", sa.Integer(), nullable=False),
        sa.Column("tipo_firma", HORAS_EXTRA_TIPO_FIRMA_ENUM, nullable=False),
        sa.Column("aprobador_id", sa.Integer(), nullable=True),
        sa.Column("rol_aprobador_id", sa.Integer(), nullable=True),
        sa.Column("rol_aprobador_nombre", sa.String(length=50), nullable=True),
        sa.Column(
            "estado",
            HORAS_EXTRA_APROBACION_ESTADO_ENUM,
            server_default="pendiente",
            nullable=False,
        ),
        sa.Column("fecha_aprobacion", sa.DateTime(timezone=True), nullable=True),
        sa.Column("comentario", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "(estado = 'pendiente' AND aprobador_id IS NULL AND fecha_aprobacion IS NULL) "
            "OR (estado IN ('aprobado', 'rechazado') "
            "AND aprobador_id IS NOT NULL AND fecha_aprobacion IS NOT NULL)",
            name="chk_he_aprobacion_firmada",
        ),
        sa.ForeignKeyConstraint(
            ["solicitud_id"],
            ["horas_extra_solicitudes.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["aprobador_id"], ["empleados.id"]),
        sa.ForeignKeyConstraint(["rol_aprobador_id"], ["roles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("solicitud_id", "tipo_firma", name="uq_he_aprobacion_solicitud_tipo"),
    )

    op.create_index("idx_he_solicitudes_estado", "horas_extra_solicitudes", ["estado"])
    op.create_index(
        "idx_he_solicitudes_semana_estado",
        "horas_extra_solicitudes",
        ["semana_inicio", "estado"],
    )
    op.create_index(
        "idx_he_solicitudes_org",
        "horas_extra_solicitudes",
        ["area_id", "subarea_id"],
    )
    op.create_index(
        "idx_he_solicitudes_centrocosto",
        "horas_extra_solicitudes",
        ["centrocosto_id"],
    )
    op.create_index(
        "idx_he_solicitudes_registrado_por",
        "horas_extra_solicitudes",
        ["registrado_por_id"],
    )
    op.create_index(
        "idx_he_solicitudes_fecha",
        "horas_extra_solicitudes",
        [sa.text("fecha_solicitud DESC")],
    )
    op.create_index(
        "idx_he_detalle_empleado",
        "horas_extra_solicitud_detalle",
        ["empleado_id"],
    )
    op.create_index(
        "idx_he_aprobaciones_aprobador_estado",
        "horas_extra_aprobaciones",
        ["aprobador_id", "estado"],
    )

    op.execute(
        """
        CREATE VIEW v_horas_extra_solicitud_totales AS
        SELECT
            d.solicitud_id,
            COUNT(d.id) AS total_empleados,
            COALESCE(SUM(d.total_horas), 0) AS total_horas_general
        FROM horas_extra_solicitud_detalle d
        GROUP BY d.solicitud_id
        """
    )

    op.execute(
        """
        CREATE VIEW v_horas_extra_detalle_empleado AS
        SELECT
            d.id,
            d.solicitud_id,
            e.id AS empleado_pk,
            e.no_empleado,
            e.nombre AS nombre_empleado,
            d.lunes,
            d.martes,
            d.miercoles,
            d.jueves,
            d.viernes,
            d.sabado,
            d.domingo,
            d.total_horas
        FROM horas_extra_solicitud_detalle d
        JOIN empleados e ON e.id = d.empleado_id
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION fn_validar_estado_horas_extra_solicitud()
        RETURNS TRIGGER AS $$
        DECLARE
            v_pendientes  INT;
            v_rechazadas  INT;
            v_aprobadas   INT;
            v_nuevo_estado horas_extra_estado_enum;
            v_solicitud_id INT;
        BEGIN
            v_solicitud_id := COALESCE(NEW.solicitud_id, OLD.solicitud_id);

            SELECT
                COUNT(*) FILTER (WHERE estado = 'pendiente'),
                COUNT(*) FILTER (WHERE estado = 'rechazado'),
                COUNT(*) FILTER (WHERE estado = 'aprobado')
            INTO v_pendientes, v_rechazadas, v_aprobadas
            FROM horas_extra_aprobaciones
            WHERE solicitud_id = v_solicitud_id;

            IF (v_pendientes + v_rechazadas + v_aprobadas) <> 3 THEN
                RAISE EXCEPTION 'La solicitud debe tener exactamente 3 aprobaciones obligatorias';
            END IF;

            IF v_rechazadas > 0 THEN
                v_nuevo_estado := 'rechazado';
            ELSIF v_aprobadas = 3 THEN
                v_nuevo_estado := 'aprobado';
            ELSE
                v_nuevo_estado := 'pendiente';
            END IF;

            UPDATE horas_extra_solicitudes
            SET estado = v_nuevo_estado,
                updated_at = NOW()
            WHERE id = v_solicitud_id
              AND estado NOT IN ('borrador', 'cancelado');

            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_he_aprobaciones_sync_estado
        AFTER INSERT OR UPDATE OF estado, aprobador_id, fecha_aprobacion
        ON horas_extra_aprobaciones
        FOR EACH ROW
        EXECUTE FUNCTION fn_validar_estado_horas_extra_solicitud()
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION fn_seed_aprobaciones_horas_extra()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.estado IN ('pendiente', 'borrador') THEN
                INSERT INTO horas_extra_aprobaciones (solicitud_id, tipo_firma, estado)
                VALUES
                    (NEW.id, 'gerente_area', 'pendiente'),
                    (NEW.id, 'gerente_regional', 'pendiente'),
                    (NEW.id, 'director_planta', 'pendiente');
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_he_solicitud_seed_aprobaciones
        AFTER INSERT ON horas_extra_solicitudes
        FOR EACH ROW
        EXECUTE FUNCTION fn_seed_aprobaciones_horas_extra()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_he_solicitud_seed_aprobaciones ON horas_extra_solicitudes")
    op.execute("DROP FUNCTION IF EXISTS fn_seed_aprobaciones_horas_extra()")
    op.execute("DROP TRIGGER IF EXISTS trg_he_aprobaciones_sync_estado ON horas_extra_aprobaciones")
    op.execute("DROP FUNCTION IF EXISTS fn_validar_estado_horas_extra_solicitud()")
    op.execute("DROP VIEW IF EXISTS v_horas_extra_detalle_empleado")
    op.execute("DROP VIEW IF EXISTS v_horas_extra_solicitud_totales")

    op.drop_index("idx_he_aprobaciones_aprobador_estado", table_name="horas_extra_aprobaciones")
    op.drop_index("idx_he_detalle_empleado", table_name="horas_extra_solicitud_detalle")
    op.drop_index("idx_he_solicitudes_fecha", table_name="horas_extra_solicitudes")
    op.drop_index("idx_he_solicitudes_registrado_por", table_name="horas_extra_solicitudes")
    op.drop_index("idx_he_solicitudes_centrocosto", table_name="horas_extra_solicitudes")
    op.drop_index("idx_he_solicitudes_org", table_name="horas_extra_solicitudes")
    op.drop_index("idx_he_solicitudes_semana_estado", table_name="horas_extra_solicitudes")
    op.drop_index("idx_he_solicitudes_estado", table_name="horas_extra_solicitudes")

    op.drop_table("horas_extra_aprobaciones")
    op.drop_table("horas_extra_solicitud_detalle")
    op.drop_table("horas_extra_solicitudes")
    op.drop_table("horas_extra_motivos")
    op.drop_table("centros_costo")

    HORAS_EXTRA_APROBACION_ESTADO_ENUM.drop(op.get_bind(), checkfirst=True)
    HORAS_EXTRA_TIPO_FIRMA_ENUM.drop(op.get_bind(), checkfirst=True)
    HORAS_EXTRA_ESTADO_ENUM.drop(op.get_bind(), checkfirst=True)
    HORAS_EXTRA_TIPO_ENUM.drop(op.get_bind(), checkfirst=True)
