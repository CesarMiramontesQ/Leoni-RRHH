"""permisos por módulo: dividir 'nominas' en permisos por página

Convierte el grant único 'nominas' (acceso a toda la sección) en los tres
permisos por página: 'nominas-horas-extra', 'nominas-conciliacion',
'nominas-ajustes' (preservando el valor true/false). No toca a usuarios RH con
modulos_rh vacío (acceso completo legado).

Revision ID: k9f0y1u2s3b4
Revises: j8e9x0t1r2a3
Create Date: 2026-06-15
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "k9f0y1u2s3b4"
down_revision: Union[str, None] = "j8e9x0t1r2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE empleados
        SET modulos_rh = (modulos_rh - 'nominas')
            || jsonb_build_object(
                 'nominas-horas-extra', modulos_rh->'nominas',
                 'nominas-conciliacion', modulos_rh->'nominas',
                 'nominas-ajustes', modulos_rh->'nominas'
               )
        WHERE modulos_rh ? 'nominas'
        """
    )


def downgrade() -> None:
    # Reagrupa: 'nominas' = true si tenía cualquiera de las tres páginas.
    op.execute(
        """
        UPDATE empleados
        SET modulos_rh = (modulos_rh
                - 'nominas-horas-extra' - 'nominas-conciliacion' - 'nominas-ajustes')
            || jsonb_build_object(
                 'nominas',
                 (COALESCE((modulos_rh->>'nominas-horas-extra')::boolean, false)
                  OR COALESCE((modulos_rh->>'nominas-conciliacion')::boolean, false)
                  OR COALESCE((modulos_rh->>'nominas-ajustes')::boolean, false))
               )
        WHERE modulos_rh ? 'nominas-horas-extra'
           OR modulos_rh ? 'nominas-conciliacion'
           OR modulos_rh ? 'nominas-ajustes'
        """
    )
