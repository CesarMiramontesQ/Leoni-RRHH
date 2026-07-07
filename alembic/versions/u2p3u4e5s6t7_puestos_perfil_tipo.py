"""puestos_perfil tipo clasificacion

Revision ID: u2p3u4e5s6t7
Revises: t1a2r3d4e5s6
Create Date: 2026-07-07

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "u2p3u4e5s6t7"
down_revision: Union[str, None] = "t1a2r3d4e5s6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'levelup_puestos_perfil' AND column_name = 'tipo'
            ) THEN
                ALTER TABLE levelup_puestos_perfil
                ADD COLUMN tipo VARCHAR(50) NOT NULL DEFAULT 'operativo';
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        UPDATE levelup_puestos_perfil
        SET tipo = 'operativo'
        WHERE tipo IS NULL OR btrim(tipo) = ''
        """
    )
    op.execute(
        """
        ALTER TABLE levelup_puestos_perfil
        ALTER COLUMN tipo SET DEFAULT 'operativo'
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_levelup_puestos_perfil_tipo'
            ) THEN
                ALTER TABLE levelup_puestos_perfil
                ADD CONSTRAINT ck_levelup_puestos_perfil_tipo
                CHECK (tipo IN ('administrativo', 'operativo'));
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE levelup_puestos_perfil
        DROP CONSTRAINT IF EXISTS ck_levelup_puestos_perfil_tipo
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'levelup_puestos_perfil' AND column_name = 'tipo'
            ) THEN
                ALTER TABLE levelup_puestos_perfil DROP COLUMN tipo;
            END IF;
        END $$;
        """
    )
