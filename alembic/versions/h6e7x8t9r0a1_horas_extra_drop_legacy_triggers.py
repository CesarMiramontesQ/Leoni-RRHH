"""horas extra — eliminar triggers legacy de aprobaciones (lógica en aplicación)

Revision ID: h6e7x8t9r0a1
Revises: h5e6x7t8r9a0
Create Date: 2026-06-13
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "h6e7x8t9r0a1"
down_revision: Union[str, None] = "h5e6x7t8r9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # El seed y la sincronización de estado viven en la capa de servicio
    # (seed_firmas_solicitud + calcular_estado). Los triggers legacy insertaban
    # 3 firmas fijas (incl. gerente_area) y chocaban con el seed de la app.
    op.execute(
        "DROP TRIGGER IF EXISTS trg_he_solicitud_seed_aprobaciones "
        "ON horas_extra_solicitudes"
    )
    op.execute("DROP FUNCTION IF EXISTS fn_seed_aprobaciones_horas_extra()")
    op.execute(
        "DROP TRIGGER IF EXISTS trg_he_aprobaciones_sync_estado "
        "ON horas_extra_aprobaciones"
    )
    op.execute(
        "DROP FUNCTION IF EXISTS fn_validar_estado_horas_extra_solicitud()"
    )


def downgrade() -> None:
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
                RAISE EXCEPTION
                    'La solicitud debe tener exactamente 3 aprobaciones obligatorias';
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
