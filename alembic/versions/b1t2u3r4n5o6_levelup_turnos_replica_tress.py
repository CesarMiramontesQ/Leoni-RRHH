"""levelup_turnos — réplica en Bono del catálogo de turnos de TRESS

Espeja 1:1 las 40 columnas de ``[Datos].[dbo].[TURNO]`` (DATOS_ANALISIS, SQL Server),
con la misma llave primaria (``tu_codigo``). No es una tabla editable: la app la lee y
la carga se hace desde el origen.

Solo DDL. Los datos NO viajan en la migración, por dos motivos: origen y destino son
motores distintos (SQL Server ↔ PostgreSQL) y Bono no tiene ``tds_fdw``, así que no hay
`INSERT ... SELECT` posible; y una migración no debe depender de que la BD externa esté
accesible en el momento del deploy. La carga va aparte, con
``docs/sql/levelup_turnos_replica.sql``.

Mapeo de tipos SQL Server → PostgreSQL: char(n)→CHAR(n), varchar(n)→VARCHAR(n),
smallint→SMALLINT, int→INTEGER, numeric(p,s)→NUMERIC(p,s), datetime→TIMESTAMP.
``datetime`` de SQL Server tiene resolución ~3.33 ms; el TIMESTAMP de PostgreSQL
(microsegundos) la contiene sin pérdida, por eso no se fija precisión.

Revision ID: b1t2u3r4n5o6
Revises: a1v2a3c4t5r6
Create Date: 2026-08-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "b1t2u3r4n5o6"
down_revision: Union[str, None] = "a1v2a3c4t5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("levelup_turnos"):
        return

    op.create_table(
        "levelup_turnos",
        sa.Column("tu_codigo", sa.CHAR(6), nullable=False),
        sa.Column("tu_descrip", sa.String(100), nullable=False),
        sa.Column("tu_dias", sa.SmallInteger(), nullable=False),
        sa.Column("tu_dobles", sa.Numeric(15, 2), nullable=False),
        sa.Column("tu_domingo", sa.Numeric(15, 2), nullable=False),
        sa.Column("tu_festivo", sa.CHAR(1), nullable=False),
        # Horario aplicable a cada día de la semana; referencia dbo.HORARIO en el origen.
        sa.Column("tu_hor_1", sa.CHAR(6), nullable=False),
        sa.Column("tu_hor_2", sa.CHAR(6), nullable=False),
        sa.Column("tu_hor_3", sa.CHAR(6), nullable=False),
        sa.Column("tu_hor_4", sa.CHAR(6), nullable=False),
        sa.Column("tu_hor_5", sa.CHAR(6), nullable=False),
        sa.Column("tu_hor_6", sa.CHAR(6), nullable=False),
        sa.Column("tu_hor_7", sa.CHAR(6), nullable=False),
        sa.Column("tu_horario", sa.SmallInteger(), nullable=False),
        sa.Column("tu_jornada", sa.Numeric(15, 2), nullable=False),
        sa.Column("tu_nomina", sa.SmallInteger(), nullable=False),
        sa.Column("tu_rit_ini", sa.DateTime(), nullable=False),
        # Patrón rotativo; contiene CRLF en el origen y se replica sin recortar.
        sa.Column("tu_rit_pat", sa.String(4096), nullable=False),
        # Tipo de día (0 = laborable, 2 = descanso, …) para cada día de la semana.
        sa.Column("tu_tip_1", sa.SmallInteger(), nullable=False),
        sa.Column("tu_tip_2", sa.SmallInteger(), nullable=False),
        sa.Column("tu_tip_3", sa.SmallInteger(), nullable=False),
        sa.Column("tu_tip_4", sa.SmallInteger(), nullable=False),
        sa.Column("tu_tip_5", sa.SmallInteger(), nullable=False),
        sa.Column("tu_tip_6", sa.SmallInteger(), nullable=False),
        sa.Column("tu_tip_7", sa.SmallInteger(), nullable=False),
        sa.Column("tu_tip_jor", sa.SmallInteger(), nullable=False),
        sa.Column("tu_ingles", sa.String(100), nullable=False),
        sa.Column("tu_texto", sa.String(100), nullable=False),
        sa.Column("tu_numero", sa.Numeric(15, 2), nullable=False),
        sa.Column("tu_hor_fes", sa.CHAR(6), nullable=False),
        sa.Column("tu_vaca_ha", sa.Numeric(15, 2), nullable=False),
        sa.Column("tu_vaca_sa", sa.Numeric(15, 2), nullable=False),
        sa.Column("tu_vaca_de", sa.Numeric(15, 2), nullable=False),
        sa.Column("tu_sub_cta", sa.String(100), nullable=False),
        sa.Column("tu_dias_ba", sa.Numeric(15, 5), nullable=False),
        sa.Column("tu_activo", sa.CHAR(1), nullable=False),
        sa.Column("tu_tip_jt", sa.SmallInteger(), nullable=False),
        # Identificador interno de TRESS. Se replica, pero la llave es tu_codigo.
        sa.Column("llave", sa.Integer(), nullable=False),
        sa.Column("tu_nivel0", sa.String(255), nullable=False),
        sa.Column("tu_sat_jor", sa.CHAR(6), nullable=False),
        sa.PrimaryKeyConstraint("tu_codigo", name="pk_levelup_turnos"),
    )


def downgrade() -> None:
    if not table_exists("levelup_turnos"):
        return
    op.drop_table("levelup_turnos")
