"""Tipo `vacaciones` en faltas/retardos e incidencias

El sync de incidencias pasa a traer también `AU_TIPO = 'VAC'` de dbo.AUSENCIA. El tipo
nuevo toca dos objetos: el enum de `levelup_faltas_retardos.tipo` y el CHECK de
`levelup_incidencias_tress.tipo`, que se deriva de `FALTA_RETARDO_TIPOS`.

`vacaciones` no se captura a mano: el modal no lo ofrece y el alta lo rechazaría. Entra
al enum solo porque las dos tablas comparten la lista de tipos.

Revision ID: a1v2a3c4t5r6
Revises: y1i2n3c4t5r6
Create Date: 2026-08-10
"""

from typing import Sequence, Union

from alembic import op

from app.models.faltas_retardos import FALTA_RETARDO_TIPOS
from app.utils.migration_helpers import table_exists

revision: str = "a1v2a3c4t5r6"
down_revision: Union[str, None] = "y1i2n3c4t5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CHECK = "chk_levelup_incidencias_tress_tipo"
_TIPOS_SQL = ", ".join(f"'{t}'" for t in FALTA_RETARDO_TIPOS)


def upgrade() -> None:
    # 1. Enum de levelup_faltas_retardos. ADD VALUE es idempotente con IF NOT EXISTS y no
    #    se puede revertir: PostgreSQL no permite quitar valores de un enum.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TYPE falta_retardo_tipo_enum ADD VALUE IF NOT EXISTS 'vacaciones'"
        )

    # 2. CHECK de la caché de incidencias: se recrea con la lista completa de tipos.
    #    `constraint_names` solo lista uniques, así que se dropea con IF EXISTS.
    if not table_exists("levelup_incidencias_tress"):
        return
    if bind.dialect.name == "postgresql":
        op.execute(
            f"ALTER TABLE levelup_incidencias_tress DROP CONSTRAINT IF EXISTS {_CHECK}"
        )
        op.create_check_constraint(
            _CHECK, "levelup_incidencias_tress", f"tipo IN ({_TIPOS_SQL})"
        )


def downgrade() -> None:
    # El valor del enum se queda: PostgreSQL no permite retirarlo de forma segura.
    # El CHECK vuelve a la lista sin `vacaciones`; falla si ya hay filas de ese tipo,
    # que es justo lo que debe pasar (habría que borrarlas antes).
    bind = op.get_bind()
    if not table_exists("levelup_incidencias_tress") or bind.dialect.name != "postgresql":
        return
    tipos_previos = ", ".join(
        f"'{t}'" for t in FALTA_RETARDO_TIPOS if t != "vacaciones"
    )
    op.execute(
        f"ALTER TABLE levelup_incidencias_tress DROP CONSTRAINT IF EXISTS {_CHECK}"
    )
    op.create_check_constraint(
        _CHECK, "levelup_incidencias_tress", f"tipo IN ({tipos_previos})"
    )
