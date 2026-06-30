-- Fila única de importadas_historico para respuesta API (compatible con map_bono_row).
SELECT
    CAST('importadas_historico' AS text) AS origen,
    ih.id AS origen_id,
    e.empleado_id,
    CAST(e.no_empleado AS text) AS no_empleado,
    e.nombre,
    p.codigo AS tipo_codigo,
    p.descripcion AS tipo_descripcion,
    CASE
        WHEN sem.fecha_ini IS NOT NULL
            AND EXTRACT(YEAR FROM sem.fecha_ini) BETWEEN 1900 AND 2100
        THEN CAST(sem.fecha_ini AS date)
        ELSE CAST(NULL AS date)
    END AS fecha_evento,
    CAST(NULL AS date) AS fecha_fin
FROM importadas_historico ih
INNER JOIN ponderaciones p ON p.codigo = ih.tipo_inc
JOIN empleados e ON CAST(e.no_empleado AS text) = CAST(ih.no_empleado AS text)
LEFT JOIN semana_historico sem ON sem.id = ih.id_semana
WHERE ih.id = :origen_id
