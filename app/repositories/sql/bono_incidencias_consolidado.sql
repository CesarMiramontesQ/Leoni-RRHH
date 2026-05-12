-- Consolidado de incidencias (bono_productividad) — solo lectura.
-- Filtros nombrados :f_empleado_id, :f_no_empleado, :f_tipo, :f_semana_id. Usar CAST(...) en lugar de casts con doble dos puntos de PostgreSQL.
WITH seguridad_detalle AS (
    SELECT
        d.id_incidencia,
        string_agg(
            ai.nombre || ': ' || ai.descripcion,
            ' | ' ORDER BY ai.articulo_id
        ) AS articulos
    FROM incidencias_seg_detalle d
    LEFT JOIN articulos_infraccion ai ON ai.articulo_id = d.id_articulo
    GROUP BY d.id_incidencia
),
incidencias AS (
    SELECT
        CAST('calidad' AS text) AS tipo,
        ic.id,
        ic.id_empleado AS empleado_id,
        e.no_empleado,
        e.nombre,
        CASE
            WHEN ic.fecha IS NOT NULL
                AND EXTRACT(YEAR FROM ic.fecha) BETWEEN 1900 AND 2100
            THEN CAST(ic.fecha AS date)
            ELSE CAST(NULL AS date)
        END AS fecha,
        CAST(NULL AS integer) AS semana_id,
        CAST(NULL AS integer) AS numero_semana,
        cat.nombre AS categoria,
        ic.motivo AS detalle,
        pc.porcentaje AS descuento_porcentaje,
        ic.estatus_id,
        ic.area_empleado,
        ic.subarea_empleado
    FROM incidencias_calidad ic
    JOIN empleados e ON e.empleado_id = ic.id_empleado
    LEFT JOIN incidencia_categoria cat ON cat.id = ic.incidencia_categoria_id
    LEFT JOIN ponderacion_calidad pc ON pc.id = ic.porcentaje

    UNION ALL

    SELECT
        CAST('calidad_historico' AS text) AS tipo,
        ch.id,
        ch.id_empleado AS empleado_id,
        e.no_empleado,
        e.nombre,
        CASE
            WHEN ch.fecha IS NOT NULL
                AND EXTRACT(YEAR FROM ch.fecha) BETWEEN 1900 AND 2100
            THEN CAST(ch.fecha AS date)
            ELSE CAST(NULL AS date)
        END AS fecha,
        ch.id_semana AS semana_id,
        sh.numero_semana,
        cat.nombre AS categoria,
        ch.motivo AS detalle,
        pc.porcentaje AS descuento_porcentaje,
        CAST(NULL AS integer) AS estatus_id,
        ch.area_empleado,
        ch.subarea_empleado
    FROM calidad_historico ch
    JOIN empleados e ON e.empleado_id = ch.id_empleado
    LEFT JOIN semana_historico sh ON sh.id = ch.id_semana
    LEFT JOIN incidencia_categoria cat ON cat.id = ch.incidencia_categoria_id
    LEFT JOIN ponderacion_calidad pc ON pc.id = ch.porcentaje

    UNION ALL

    SELECT
        CAST('seguridad' AS text) AS tipo,
        iseg.id,
        iseg.id_empleado AS empleado_id,
        e.no_empleado,
        e.nombre,
        CASE
            WHEN iseg.fecha IS NOT NULL
                AND EXTRACT(YEAR FROM iseg.fecha) BETWEEN 1900 AND 2100
            THEN CAST(iseg.fecha AS date)
            ELSE CAST(NULL AS date)
        END AS fecha,
        CAST(NULL AS integer) AS semana_id,
        CAST(NULL AS integer) AS numero_semana,
        ps.descripcion AS categoria,
        coalesce(iseg.observaciones, '') || coalesce(' | Articulos: ' || sd.articulos, '') AS detalle,
        ps.porcentaje AS descuento_porcentaje,
        iseg.estatus_id,
        iseg.area_empleado,
        iseg.subarea_empleado
    FROM incidencias_seguridad iseg
    JOIN empleados e ON e.empleado_id = iseg.id_empleado
    LEFT JOIN ponderacion_seguridad ps ON ps.id = iseg.porcentaje_id
    LEFT JOIN seguridad_detalle sd ON sd.id_incidencia = iseg.id

    UNION ALL

    SELECT
        CAST('seguridad_historico' AS text) AS tipo,
        shis.id,
        shis.id_empleado AS empleado_id,
        e.no_empleado,
        e.nombre,
        CASE
            WHEN shis.fecha IS NOT NULL
                AND EXTRACT(YEAR FROM shis.fecha) BETWEEN 1900 AND 2100
            THEN CAST(shis.fecha AS date)
            ELSE CAST(NULL AS date)
        END AS fecha,
        shis.id_semana AS semana_id,
        sem.numero_semana,
        ps.descripcion AS categoria,
        shis.observaciones AS detalle,
        ps.porcentaje AS descuento_porcentaje,
        CAST(NULL AS integer) AS estatus_id,
        shis.area_empleado,
        shis.subarea_empleado
    FROM seguridad_historico shis
    JOIN empleados e ON e.empleado_id = shis.id_empleado
    LEFT JOIN semana_historico sem ON sem.id = shis.id_semana
    LEFT JOIN ponderacion_seguridad ps ON ps.id = shis.porcentaje_id

    UNION ALL

    SELECT
        CAST('progresivo' AS text) AS tipo,
        ip.inc_prog_id AS id,
        ip.id_empleado AS empleado_id,
        e.no_empleado,
        e.nombre,
        CAST(NULL AS date) AS fecha,
        ip.id_semana AS semana_id,
        sem.numero_semana,
        CAST('incidencias_progresivo' AS text) AS categoria,
        concat_ws(
            ' | ',
            CASE WHEN coalesce(ip.faltas_injustificadas, 0) > 0 THEN 'Faltas injustificadas: ' || ip.faltas_injustificadas END,
            CASE WHEN coalesce(ip.suspensiones, 0) > 0 THEN 'Suspensiones: ' || ip.suspensiones END,
            CASE WHEN coalesce(ip.quejas_calidad, 0) > 0 THEN 'Quejas calidad: ' || ip.quejas_calidad END,
            CASE WHEN coalesce(ip.actas_admin, 0) > 0 THEN 'Actas admin: ' || ip.actas_admin END,
            CASE WHEN coalesce(ip.faltas_justificadas, 0) > 0 THEN 'Faltas justificadas: ' || ip.faltas_justificadas END,
            CASE WHEN coalesce(ip.vacaciones, 0) > 0 THEN 'Vacaciones: ' || ip.vacaciones END,
            CASE WHEN coalesce(ip.permiso_congoce, 0) > 0 THEN 'Permiso con goce: ' || ip.permiso_congoce END,
            CASE WHEN coalesce(ip.proporcional_turno, 0) > 0 THEN 'Proporcional turno: ' || ip.proporcional_turno END,
            CASE WHEN coalesce(ip.pierde_bono, 0) = 1 THEN 'Pierde bono' END,
            CASE WHEN ip.proporcional IS NOT NULL THEN 'Proporcional: ' || ip.proporcional END,
            CASE WHEN l.descripcion IS NOT NULL THEN 'Linea: ' || l.descripcion END
        ) AS detalle,
        CAST(NULL AS double precision) AS descuento_porcentaje,
        ip.estatus_id,
        ip.area_id AS area_empleado,
        CAST(NULL AS integer) AS subarea_empleado
    FROM incidencias_progresivo ip
    JOIN empleados e ON e.empleado_id = ip.id_empleado
    LEFT JOIN semana_historico sem ON sem.id = ip.id_semana
    LEFT JOIN lineas l ON l.linea_id = ip.linea_id

    UNION ALL

    SELECT
        CAST('progresivo_historico' AS text) AS tipo,
        iph.inc_prog_id AS id,
        iph.id_empleado AS empleado_id,
        e.no_empleado,
        e.nombre,
        CAST(NULL AS date) AS fecha,
        iph.id_semana AS semana_id,
        sem.numero_semana,
        CAST('incidencias_progresivo_historico' AS text) AS categoria,
        concat_ws(
            ' | ',
            CASE WHEN coalesce(iph.faltas_injustificadas, 0) > 0 THEN 'Faltas injustificadas: ' || iph.faltas_injustificadas END,
            CASE WHEN coalesce(iph.suspensiones, 0) > 0 THEN 'Suspensiones: ' || iph.suspensiones END,
            CASE WHEN coalesce(iph.quejas_calidad, 0) > 0 THEN 'Quejas calidad: ' || iph.quejas_calidad END,
            CASE WHEN coalesce(iph.actas_admin, 0) > 0 THEN 'Actas admin: ' || iph.actas_admin END,
            CASE WHEN coalesce(iph.faltas_justificadas, 0) > 0 THEN 'Faltas justificadas: ' || iph.faltas_justificadas END,
            CASE WHEN coalesce(iph.vacaciones, 0) > 0 THEN 'Vacaciones: ' || iph.vacaciones END,
            CASE WHEN coalesce(iph.permiso_congoce, 0) > 0 THEN 'Permiso con goce: ' || iph.permiso_congoce END,
            CASE WHEN coalesce(iph.proporcional_turno, 0) > 0 THEN 'Proporcional turno: ' || iph.proporcional_turno END,
            CASE WHEN coalesce(iph.pierde_bono, 0) = 1 THEN 'Pierde bono' END,
            CASE WHEN iph.proporcional IS NOT NULL THEN 'Proporcional: ' || iph.proporcional END,
            CASE WHEN l.descripcion IS NOT NULL THEN 'Linea: ' || l.descripcion END
        ) AS detalle,
        CAST(NULL AS double precision) AS descuento_porcentaje,
        CAST(NULL AS integer) AS estatus_id,
        iph.area_id AS area_empleado,
        CAST(NULL AS integer) AS subarea_empleado
    FROM incidencias_progresivo_historico iph
    JOIN empleados e ON e.empleado_id = iph.id_empleado
    LEFT JOIN semana_historico sem ON sem.id = iph.id_semana
    LEFT JOIN lineas l ON l.linea_id = iph.linea_id
)
SELECT
    i.tipo,
    i.id,
    i.empleado_id,
    CAST(i.no_empleado AS text) AS no_empleado,
    i.nombre,
    i.fecha,
    i.semana_id,
    i.numero_semana,
    i.categoria,
    i.detalle,
    i.descuento_porcentaje,
    i.estatus_id,
    a.descripcion AS area,
    s.descripcion AS subarea
FROM incidencias i
LEFT JOIN areas a ON a.area_id = i.area_empleado
LEFT JOIN subareas s ON s.subarea_id = i.subarea_empleado
WHERE
    (CAST(:f_empleado_id AS integer) IS NULL OR i.empleado_id = CAST(:f_empleado_id AS integer))
    AND (CAST(:f_no_empleado AS text) IS NULL OR CAST(i.no_empleado AS text) = CAST(:f_no_empleado AS text))
    AND (CAST(:f_tipo AS text) IS NULL OR i.tipo = CAST(:f_tipo AS text))
    AND (CAST(:f_semana_id AS integer) IS NULL OR i.semana_id = CAST(:f_semana_id AS integer))
ORDER BY
    i.nombre,
    i.tipo,
    i.semana_id NULLS LAST,
    i.fecha NULLS LAST;
