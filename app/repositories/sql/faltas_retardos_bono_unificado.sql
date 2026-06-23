-- Faltas y retardos desde bono_productividad.
--
-- Rama A: importadas_historico excluyendo VAC y FJ (resueltos vía ponderaciones.inc_id).
-- Rama B: falta justificada (FJ) vía JOIN ponderaciones ON ih.inc_id = p.id.
-- Rama C: falta justificada en evaluacion_historica vía id_ponderacion → ponderaciones.
--
-- fecha_evento: inicio de semana (semana_historico.fecha_ini) cuando existe.

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
    CAST(NULL AS date) AS fecha_fin,
    CAST(NULL AS text) AS observaciones,
    COALESCE(NULLIF(TRIM(ar.descripcion), ''), '(sin área)') AS area
FROM importadas_historico ih
INNER JOIN ponderaciones p ON p.codigo = ih.tipo_inc
JOIN empleados e ON CAST(e.no_empleado AS text) = CAST(ih.no_empleado AS text)
LEFT JOIN semana_historico sem ON sem.id = ih.id_semana
LEFT JOIN areas ar ON ar.area_id = ih.area_empleado
WHERE ih.tipo_inc NOT IN ('VAC', 'FJ')
  AND p.codigo IN ('FI', 'RE', 'INC', 'IN1', 'ITR', 'IAC', 'SUS')

UNION ALL

SELECT
    CAST('ponderaciones' AS text) AS origen,
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
    CAST(NULL AS date) AS fecha_fin,
    CAST(NULL AS text) AS observaciones,
    COALESCE(NULLIF(TRIM(ar.descripcion), ''), '(sin área)') AS area
FROM importadas_historico ih
INNER JOIN ponderaciones p ON p.id = ih.inc_id
JOIN empleados e ON CAST(e.no_empleado AS text) = CAST(ih.no_empleado AS text)
LEFT JOIN semana_historico sem ON sem.id = ih.id_semana
LEFT JOIN areas ar ON ar.area_id = ih.area_empleado
WHERE p.codigo = 'FJ'

UNION ALL

SELECT
    CAST('evaluacion_historica' AS text) AS origen,
    eh.id AS origen_id,
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
    CAST(NULL AS date) AS fecha_fin,
    CAST(NULL AS text) AS observaciones,
    COALESCE(NULLIF(TRIM(ar.descripcion), ''), '(sin área)') AS area
FROM evaluacion_historica eh
INNER JOIN ponderaciones p ON p.id = eh.id_ponderacion
JOIN empleados e ON e.empleado_id = eh.empleado_id
LEFT JOIN semana_historico sem ON sem.id = eh.id_semana
LEFT JOIN areas ar ON ar.area_id = eh.area_empleado
WHERE p.codigo = 'FJ'
