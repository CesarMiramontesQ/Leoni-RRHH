-- Base de incidencias desde calidad_historico (bono_productividad) — solo lectura.
-- El repositorio añade la cláusula WHERE dinámica y paginación externa.
SELECT
    ch.id AS origen_id,
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
