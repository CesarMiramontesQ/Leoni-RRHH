"""empleados_catalogos

Revision ID: d4f8a1c2e9b0
Revises: c06e332f3cce
Create Date: 2026-04-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4f8a1c2e9b0"
down_revision: Union[str, None] = "c06e332f3cce"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("audit_log_usuario_id_fkey", "audit_log", type_="foreignkey")
    op.drop_constraint("comedor_registros_empleado_id_fkey", "comedor_registros", type_="foreignkey")
    op.drop_constraint("evidencias_subido_por_fkey", "evidencias", type_="foreignkey")
    op.drop_constraint("incidencias_empleado_id_fkey", "incidencias", type_="foreignkey")
    op.drop_constraint("incidencias_registrado_por_fkey", "incidencias", type_="foreignkey")
    op.drop_constraint("menu_semanal_created_by_fkey", "menu_semanal", type_="foreignkey")
    op.drop_constraint("notificaciones_destinatario_id_fkey", "notificaciones", type_="foreignkey")
    op.drop_constraint("solicitudes_empleado_id_fkey", "solicitudes", type_="foreignkey")
    op.drop_constraint("solicitud_aprobaciones_aprobador_id_fkey", "solicitud_aprobaciones", type_="foreignkey")
    op.drop_constraint("actas_administrativas_empleado_id_fkey", "actas_administrativas", type_="foreignkey")
    op.drop_constraint("actas_administrativas_generado_por_fkey", "actas_administrativas", type_="foreignkey")
    op.drop_constraint("acta_aprobaciones_firmante_id_fkey", "acta_aprobaciones", type_="foreignkey")

    # Reemplazo completo de empleados: vaciar tablas que referencian empleados
    op.execute(sa.text("DELETE FROM acta_aprobaciones"))
    op.execute(sa.text("DELETE FROM actas_administrativas"))
    op.execute(sa.text("DELETE FROM solicitud_aprobaciones"))
    op.execute(sa.text("DELETE FROM solicitudes"))
    op.execute(sa.text("DELETE FROM notificaciones"))
    op.execute(sa.text("DELETE FROM menu_semanal"))
    op.execute(sa.text("DELETE FROM comedor_registros"))
    op.execute(sa.text("DELETE FROM evidencias"))
    op.execute(sa.text("DELETE FROM incidencias"))
    op.execute(sa.text("DELETE FROM audit_log"))

    op.drop_table("empleados")

    op.create_table(
        "areas",
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("area_id"),
    )
    op.create_table(
        "categorias",
        sa.Column("categoria_id", sa.Integer(), nullable=False),
        sa.Column("nivel", sa.String(length=50), nullable=True),
        sa.Column("bono_cat", sa.Numeric(10, 2), nullable=True),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("categoria_id"),
    )
    op.create_table(
        "subareas",
        sa.Column("subarea_id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["area_id"], ["areas.area_id"]),
        sa.PrimaryKeyConstraint("subarea_id"),
    )
    op.create_table(
        "puestos",
        sa.Column("puesto_id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["area_id"], ["areas.area_id"]),
        sa.PrimaryKeyConstraint("puesto_id"),
    )
    op.create_table(
        "estados_empleados",
        sa.Column("estado_id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("estado_id"),
    )
    op.create_table(
        "clasificacion_empleado",
        sa.Column("clasificacion_id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=False),
        sa.Column("estatus_id", sa.Integer(), nullable=False),
        sa.Column("significado", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("clasificacion_id"),
    )

    op.create_table(
        "empleados",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("no_empleado", sa.String(length=50), nullable=False),
        sa.Column("no_sap", sa.String(length=50), nullable=True),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("usuario", sa.String(length=100), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("rol_id", sa.Integer(), nullable=False),
        sa.Column("categoria_id", sa.Integer(), nullable=True),
        sa.Column("subarea_id", sa.Integer(), nullable=True),
        sa.Column("puesto_id", sa.Integer(), nullable=True),
        sa.Column("estado_id", sa.Integer(), nullable=True),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.Column("clasificacion_id", sa.Integer(), nullable=True),
        sa.Column("lider_id", sa.Integer(), nullable=True),
        sa.Column("centrocosto_id", sa.Integer(), nullable=True),
        sa.Column("foto", sa.String(length=500), nullable=True),
        sa.Column("recibe_bono", sa.Boolean(), nullable=True),
        sa.Column("brigada", sa.String(length=100), nullable=True),
        sa.Column("registro", sa.Date(), nullable=True),
        sa.Column("a_restringido", sa.Boolean(), nullable=True),
        sa.Column("requiere_cambio_password", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["rol_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["categoria_id"], ["categorias.categoria_id"]),
        sa.ForeignKeyConstraint(["subarea_id"], ["subareas.subarea_id"]),
        sa.ForeignKeyConstraint(["puesto_id"], ["puestos.puesto_id"]),
        sa.ForeignKeyConstraint(["estado_id"], ["estados_empleados.estado_id"]),
        sa.ForeignKeyConstraint(["area_id"], ["areas.area_id"]),
        sa.ForeignKeyConstraint(["clasificacion_id"], ["clasificacion_empleado.clasificacion_id"]),
        sa.ForeignKeyConstraint(["lider_id"], ["empleados.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("empleado_id"),
        sa.UniqueConstraint("no_empleado"),
        sa.UniqueConstraint("email"),
    )

    op.create_foreign_key(None, "audit_log", "empleados", ["usuario_id"], ["id"])
    op.create_foreign_key(None, "comedor_registros", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "evidencias", "empleados", ["subido_por"], ["id"])
    op.create_foreign_key(None, "incidencias", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "incidencias", "empleados", ["registrado_por"], ["id"])
    op.create_foreign_key(None, "menu_semanal", "empleados", ["created_by"], ["id"])
    op.create_foreign_key(None, "notificaciones", "empleados", ["destinatario_id"], ["id"])
    op.create_foreign_key(None, "solicitudes", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "solicitud_aprobaciones", "empleados", ["aprobador_id"], ["id"])
    op.create_foreign_key(None, "actas_administrativas", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "actas_administrativas", "empleados", ["generado_por"], ["id"])
    op.create_foreign_key(None, "acta_aprobaciones", "empleados", ["firmante_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("audit_log_usuario_id_fkey", "audit_log", type_="foreignkey")
    op.drop_constraint("comedor_registros_empleado_id_fkey", "comedor_registros", type_="foreignkey")
    op.drop_constraint("evidencias_subido_por_fkey", "evidencias", type_="foreignkey")
    op.drop_constraint("incidencias_empleado_id_fkey", "incidencias", type_="foreignkey")
    op.drop_constraint("incidencias_registrado_por_fkey", "incidencias", type_="foreignkey")
    op.drop_constraint("menu_semanal_created_by_fkey", "menu_semanal", type_="foreignkey")
    op.drop_constraint("notificaciones_destinatario_id_fkey", "notificaciones", type_="foreignkey")
    op.drop_constraint("solicitudes_empleado_id_fkey", "solicitudes", type_="foreignkey")
    op.drop_constraint("solicitud_aprobaciones_aprobador_id_fkey", "solicitud_aprobaciones", type_="foreignkey")
    op.drop_constraint("actas_administrativas_empleado_id_fkey", "actas_administrativas", type_="foreignkey")
    op.drop_constraint("actas_administrativas_generado_por_fkey", "actas_administrativas", type_="foreignkey")
    op.drop_constraint("acta_aprobaciones_firmante_id_fkey", "acta_aprobaciones", type_="foreignkey")

    op.drop_table("empleados")
    op.drop_table("clasificacion_empleado")
    op.drop_table("estados_empleados")
    op.drop_table("puestos")
    op.drop_table("subareas")
    op.drop_table("categorias")
    op.drop_table("areas")

    op.create_table(
        "empleados",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("num_empleado", sa.String(length=50), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("apellido", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("departamento", sa.String(length=150), nullable=True),
        sa.Column("puesto", sa.String(length=150), nullable=True),
        sa.Column("rol_id", sa.Integer(), nullable=False),
        sa.Column("supervisor_id", sa.Integer(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("fecha_ingreso", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["rol_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["supervisor_id"], ["empleados.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("num_empleado"),
    )
    op.create_foreign_key(None, "audit_log", "empleados", ["usuario_id"], ["id"])
    op.create_foreign_key(None, "comedor_registros", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "evidencias", "empleados", ["subido_por"], ["id"])
    op.create_foreign_key(None, "incidencias", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "incidencias", "empleados", ["registrado_por"], ["id"])
    op.create_foreign_key(None, "menu_semanal", "empleados", ["created_by"], ["id"])
    op.create_foreign_key(None, "notificaciones", "empleados", ["destinatario_id"], ["id"])
    op.create_foreign_key(None, "solicitudes", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "solicitud_aprobaciones", "empleados", ["aprobador_id"], ["id"])
    op.create_foreign_key(None, "actas_administrativas", "empleados", ["empleado_id"], ["id"])
    op.create_foreign_key(None, "actas_administrativas", "empleados", ["generado_por"], ["id"])
    op.create_foreign_key(None, "acta_aprobaciones", "empleados", ["firmante_id"], ["id"])
