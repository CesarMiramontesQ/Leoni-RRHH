"""actas: estado cancelled (anulada)

Revision ID: s2t3u4v5w6x7
Revises: r1s2t3u4v5w6
Create Date: 2026-05-07

"""

from typing import Sequence, Union

from alembic import op


revision: str = "s2t3u4v5w6x7"
down_revision: Union[str, None] = "r1s2t3u4v5w6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'acta_estado_enum' AND e.enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE acta_estado_enum ADD VALUE 'cancelled';
  END IF;
END
$block$;
"""
    )


def downgrade() -> None:
    # PostgreSQL no permite quitar valores de ENUM de forma trivial.
    pass
