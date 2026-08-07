-- Permisos con goce (FJG) desde dbo.PERMISO, expandidos a un renglon por dia.
--
-- importadas_historico guarda un dia suelto por fila, mientras que en TRESS el permiso
-- con goce es un rango. Por eso se expande aqui con una CTE recursiva (los permisos son
-- cortos: matrimonio 7 dias, paternidad 5, defuncion 3).
--
-- Criterio identico al de datos_analisis_faltas_retardos_base.sql: PM_TIPO 'FJ' con
-- PM_CLASIFI 0. PM_FEC_FIN es EXCLUSIVA en TRESS, por eso el ultimo dia es
-- PM_FEC_FIN menos uno.
--
-- Los dias FJ de dbo.AUSENCIA cubiertos por uno de estos permisos se excluyen en
-- datos_analisis_ausencias_por_tipo.sql, para no contar el mismo dia dos veces.
--
-- ausencia_llave devuelve LLAVE del permiso: sirve de referencia al origen, aunque un
-- mismo permiso produzca varios dias.
--
-- Params: fecha_inicio, fecha_fin (date).
-- Nota: no usar tokens con dos puntos en comentarios; SQLAlchemy text() los toma como binds.
WITH permisos AS (
    SELECT
        p.LLAVE                                       AS llave,
        p.CB_CODIGO                                   AS no_empleado,
        CONVERT(date, p.PM_FEC_INI)                   AS fecha_ini,
        CONVERT(date, DATEADD(day, -1, p.PM_FEC_FIN)) AS fecha_fin_incl
    FROM dbo.PERMISO p
    WHERE p.PM_TIPO = 'FJ'
      AND p.PM_CLASIFI = 0
      AND p.PM_FEC_FIN > p.PM_FEC_INI
      AND CONVERT(date, DATEADD(day, -1, p.PM_FEC_FIN)) >= :fecha_inicio
      AND CONVERT(date, p.PM_FEC_INI) <= :fecha_fin
),
dias AS (
    SELECT llave, no_empleado, fecha_ini AS fecha, fecha_fin_incl
    FROM permisos
    UNION ALL
    SELECT llave, no_empleado, DATEADD(day, 1, fecha), fecha_fin_incl
    FROM dias
    WHERE fecha < fecha_fin_incl
)
SELECT
    no_empleado,
    CAST('FJG' AS varchar(8)) AS tipo_inc,
    CAST(NULL AS int)         AS inc_id,
    fecha                     AS fecha_incidencia,
    llave                     AS ausencia_llave
FROM dias
WHERE fecha >= :fecha_inicio
  AND fecha <= :fecha_fin
ORDER BY fecha, no_empleado
OPTION (MAXRECURSION 0);
