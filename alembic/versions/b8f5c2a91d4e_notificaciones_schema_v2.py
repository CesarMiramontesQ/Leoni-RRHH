"""notificaciones schema v2

Revision ID: b8f5c2a91d4e
Revises: a7c9e1f4b2d3
Create Date: 2026-04-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b8f5c2a91d4e"
down_revision: Union[str, None] = "a7c9e1f4b2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("notificaciones", "destinatario_id", new_column_name="user_id")
    op.alter_column("notificaciones", "tipo", new_column_name="type")
    op.alter_column("notificaciones", "asunto", new_column_name="title")
    op.alter_column("notificaciones", "cuerpo", new_column_name="message")
    op.alter_column("notificaciones", "leida", new_column_name="is_read")

    op.add_column("notificaciones", sa.Column("target_url", sa.String(length=500), nullable=True))
    op.add_column(
        "notificaciones",
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "notificaciones",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
    )
    op.execute(sa.text("UPDATE notificaciones SET updated_at = created_at"))
    op.alter_column("notificaciones", "updated_at", nullable=False)

    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_notificaciones_user_fecha "
            "ON notificaciones (user_id, created_at DESC, id DESC)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_notificaciones_unread_user "
            "ON notificaciones (user_id) WHERE is_read = false"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_notificaciones_unread_user"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_notificaciones_user_fecha"))

    op.drop_column("notificaciones", "updated_at")
    op.drop_column("notificaciones", "metadata")
    op.drop_column("notificaciones", "target_url")

    op.alter_column("notificaciones", "is_read", new_column_name="leida")
    op.alter_column("notificaciones", "message", new_column_name="cuerpo")
    op.alter_column("notificaciones", "title", new_column_name="asunto")
    op.alter_column("notificaciones", "type", new_column_name="tipo")
    op.alter_column("notificaciones", "user_id", new_column_name="destinatario_id")
