-- Estados de AUSENCIA en rango (override oficial cuando existe fila).
-- Params: cb_codigo, fecha_inicio, fecha_fin.
SELECT
    CONVERT(date, a.AU_FECHA) AS fecha,
    a.AU_STATUS AS au_status
FROM dbo.AUSENCIA a
WHERE
    a.CB_CODIGO = :cb_codigo
    AND a.AU_FECHA >= :fecha_inicio
    AND CONVERT(date, a.AU_FECHA) <= :fecha_fin
ORDER BY
    fecha;
