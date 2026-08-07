-- Ausencias (FI, RE, etc.) desde dbo.AUSENCIA (SQL Server datos-analisis).
-- Params: fecha_inicio, fecha_fin (date), tipo_inc (text, p.ej. FI o RE).
-- inc_id en SELECT es NULL: el servicio asigna el id de ponderacion al insertar (FI=6, RE=8).
-- Nota: no usar tokens con dos puntos en comentarios; SQLAlchemy text() los toma como binds.
SELECT
    a.CB_CODIGO AS no_empleado,
    a.AU_TIPO AS tipo_inc,
    CAST(NULL AS int) AS inc_id,
    CONVERT(date, a.AU_FECHA) AS fecha_incidencia,
    a.LLAVE AS ausencia_llave
FROM dbo.AUSENCIA a
WHERE
    a.AU_TIPO = :tipo_inc
    AND a.AU_FECHA >= :fecha_inicio
    AND a.AU_FECHA < DATEADD(day, 1, :fecha_fin)
    -- Los dias FJ cubiertos por un permiso con goce llegan como FJG desde
    -- datos_analisis_permisos_goce_dias.sql; sin esto el mismo dia entraria dos veces.
    -- Solo actua cuando tipo_inc es FJ, porque el WHERE ya filtro AU_TIPO.
    AND NOT (
        a.AU_TIPO = 'FJ'
        AND EXISTS (
            SELECT 1
            FROM dbo.PERMISO g
            WHERE g.CB_CODIGO = a.CB_CODIGO
              AND g.PM_TIPO = 'FJ'
              AND g.PM_CLASIFI = 0
              AND a.AU_FECHA >= g.PM_FEC_INI
              AND a.AU_FECHA < g.PM_FEC_FIN
        )
    )
ORDER BY
    a.AU_FECHA,
    a.CB_CODIGO;
