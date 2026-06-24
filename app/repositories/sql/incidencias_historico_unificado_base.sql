-- Incidencias históricas unificadas (calidad_historico + seguridad_historico) — solo lectura.
-- Columnas comunes: origen, origen_id, tipo_incidencia, empleado_id, no_empleado, nombre,
-- fecha, categoria, detalle, area, subarea.
--
-- Diferencias de mapeo por fuente:
--   calidad_historico:   detalle ← motivo; categoria ← incidencia_categoria.nombre
--   seguridad_historico: detalle ← observaciones; categoria ← ponderacion_seguridad.descripcion
SELECT
    ch.id AS origen_id,
    CAST('calidad_historico' AS text) AS origen,
    CAST('Calidad' AS text) AS tipo_incidencia,
    ch.id_empleado AS empleado_id,
    CAST(e.no_empleado AS text) AS no_empleado,
    e.nombre AS nombre,
    CASE
        WHEN ch.fecha IS NOT NULL
            AND EXTRACT(YEAR FROM ch.fecha) BETWEEN 1900 AND 2100
        THEN CAST(ch.fecha AS date)
        ELSE CAST(NULL AS date)
    END AS fecha,
    cat.nombre AS categoria,
    ch.motivo AS detalle,
    a.descripcion AS area,
    s.descripcion AS subarea
FROM calidad_historico ch
JOIN empleados e ON e.empleado_id = ch.id_empleado
LEFT JOIN incidencia_categoria cat ON cat.id = ch.incidencia_categoria_id
LEFT JOIN areas a ON a.area_id = ch.area_empleado
LEFT JOIN subareas s ON s.subarea_id = ch.subarea_empleado
WHERE ch.motivo IS NOT NULL
  AND TRIM(ch.motivo) <> ''
  AND ch.id_empleado IS NOT NULL
  AND ch.fecha IS NOT NULL
  AND EXTRACT(YEAR FROM ch.fecha) BETWEEN 1900 AND 2100

UNION ALL

SELECT
    sh.id AS origen_id,
    CAST('seguridad_historico' AS text) AS origen,
    CAST('Seguridad' AS text) AS tipo_incidencia,
    sh.id_empleado AS empleado_id,
    CAST(e.no_empleado AS text) AS no_empleado,
    e.nombre AS nombre,
    CASE
        WHEN sh.fecha IS NOT NULL
            AND EXTRACT(YEAR FROM sh.fecha) BETWEEN 1900 AND 2100
        THEN CAST(sh.fecha AS date)
        ELSE CAST(NULL AS date)
    END AS fecha,
    ps.descripcion AS categoria,
    sh.observaciones AS detalle,
    a.descripcion AS area,
    s.descripcion AS subarea
FROM seguridad_historico sh
JOIN empleados e ON e.empleado_id = sh.id_empleado
LEFT JOIN ponderacion_seguridad ps ON ps.id = sh.porcentaje_id
LEFT JOIN areas a ON a.area_id = sh.area_empleado
LEFT JOIN subareas s ON s.subarea_id = sh.subarea_empleado
WHERE sh.observaciones IS NOT NULL
  AND TRIM(sh.observaciones) <> ''
  AND sh.id_empleado IS NOT NULL
  AND sh.fecha IS NOT NULL
  AND EXTRACT(YEAR FROM sh.fecha) BETWEEN 1900 AND 2100
