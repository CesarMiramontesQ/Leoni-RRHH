"""perfil_funciones

Revision ID: w6x7y8z9a0b1
Revises:
Create Date: 2026-05-24 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "w6x7y8z9a0b1"
down_revision: Union[str, Sequence[str]] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Extend puestos_perfil with perfil de funciones columns ──────────────
    op.add_column(
        "puestos_perfil",
        sa.Column("division", sa.String(20), nullable=True),
    )
    op.add_column(
        "puestos_perfil",
        sa.Column("centro_leoni", sa.String(200), nullable=True),
    )
    op.add_column(
        "puestos_perfil",
        sa.Column("form_version", sa.String(20), nullable=True),
    )
    op.add_column(
        "puestos_perfil",
        sa.Column("reporta_a", sa.String(200), nullable=True),
    )
    op.add_column(
        "puestos_perfil",
        sa.Column("ordenes_funcional_de", sa.String(200), nullable=True),
    )
    op.add_column(
        "puestos_perfil",
        sa.Column("responsable_de", sa.Text(), nullable=True),
    )
    op.add_column(
        "puestos_perfil",
        sa.Column("sustituye_a", sa.String(200), nullable=True),
    )
    op.add_column(
        "puestos_perfil",
        sa.Column("sustituido_por", sa.String(200), nullable=True),
    )
    op.add_column(
        "puestos_perfil",
        sa.Column(
            "obligaciones_empresariales",
            sa.Boolean(),
            nullable=True,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "puestos_perfil",
        sa.Column(
            "obligacion_confidencialidad",
            sa.Boolean(),
            nullable=True,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "puestos_perfil",
        sa.Column("poderes_legales", sa.Text(), nullable=True),
    )
    op.add_column(
        "puestos_perfil",
        sa.Column("complemento_poderes", sa.Text(), nullable=True),
    )

    # ── perfil_tareas ───────────────────────────────────────────────────────
    op.create_table(
        "perfil_tareas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("puesto_perfil_id", sa.Integer(), nullable=False),
        sa.Column("orden", sa.SmallInteger(), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column(
            "es_complemento",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["puesto_perfil_id"],
            ["puestos_perfil.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── perfil_cualificaciones ──────────────────────────────────────────────
    op.create_table(
        "perfil_cualificaciones",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("puesto_perfil_id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("situacion_deseada", sa.Text(), nullable=False),
        sa.Column("comentarios", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["puesto_perfil_id"],
            ["puestos_perfil.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── perfil_competencias_requeridas ──────────────────────────────────────
    op.create_table(
        "perfil_competencias_requeridas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("puesto_perfil_id", sa.Integer(), nullable=False),
        sa.Column("categoria", sa.String(50), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("orden", sa.SmallInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["puesto_perfil_id"],
            ["puestos_perfil.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── perfil_funciones ────────────────────────────────────────────────────
    op.create_table(
        "perfil_funciones",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("puesto_perfil_id", sa.Integer(), nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("departamento", sa.String(200), nullable=True),
        sa.Column("fecha_firma_superior", sa.Date(), nullable=True),
        sa.Column("fecha_firma_empleado", sa.Date(), nullable=True),
        sa.Column("firma_superior_id", sa.String(50), nullable=True),
        sa.Column("firma_empleado_id", sa.String(50), nullable=True),
        sa.Column(
            "activo",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["puesto_perfil_id"], ["puestos_perfil.id"]
        ),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_perfil_funciones_empleado_id",
        "perfil_funciones",
        ["empleado_id"],
    )
    op.create_index(
        "uq_perfil_funciones_puesto_empleado_activo",
        "perfil_funciones",
        ["puesto_perfil_id", "empleado_id"],
        unique=True,
    )

    # ── perfil_funciones_cualificacion ──────────────────────────────────────
    op.create_table(
        "perfil_funciones_cualificacion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("perfil_funciones_id", sa.Integer(), nullable=False),
        sa.Column("cualificacion_id", sa.Integer(), nullable=False),
        sa.Column("situacion_actual", sa.Text(), nullable=False),
        sa.Column("comentarios", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["perfil_funciones_id"],
            ["perfil_funciones.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["cualificacion_id"], ["perfil_cualificaciones.id"]
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── perfil_funciones_competencia ────────────────────────────────────────
    op.create_table(
        "perfil_funciones_competencia",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("perfil_funciones_id", sa.Integer(), nullable=False),
        sa.Column("competencia_requerida_id", sa.Integer(), nullable=False),
        sa.Column("situacion_actual", sa.Text(), nullable=False),
        sa.Column("comentarios", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["perfil_funciones_id"],
            ["perfil_funciones.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["competencia_requerida_id"],
            ["perfil_competencias_requeridas.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("perfil_funciones_competencia")
    op.drop_table("perfil_funciones_cualificacion")
    op.drop_table("perfil_funciones")
    op.drop_table("perfil_competencias_requeridas")
    op.drop_table("perfil_cualificaciones")
    op.drop_table("perfil_tareas")

    op.drop_column("puestos_perfil", "complemento_poderes")
    op.drop_column("puestos_perfil", "poderes_legales")
    op.drop_column("puestos_perfil", "obligacion_confidencialidad")
    op.drop_column("puestos_perfil", "obligaciones_empresariales")
    op.drop_column("puestos_perfil", "sustituido_por")
    op.drop_column("puestos_perfil", "sustituye_a")
    op.drop_column("puestos_perfil", "responsable_de")
    op.drop_column("puestos_perfil", "ordenes_funcional_de")
    op.drop_column("puestos_perfil", "reporta_a")
    op.drop_column("puestos_perfil", "form_version")
    op.drop_column("puestos_perfil", "centro_leoni")
    op.drop_column("puestos_perfil", "division")
