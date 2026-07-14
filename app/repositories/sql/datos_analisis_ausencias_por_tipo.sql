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
ORDER BY
    a.AU_FECHA,
    a.CB_CODIGO;
