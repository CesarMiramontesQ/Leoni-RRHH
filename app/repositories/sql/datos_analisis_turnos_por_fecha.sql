-- Turno efectivo por fecha via funcion escalar dbo.SP_KARDEX_CB_TURNO.
-- Params: cb_codigo, fecha_inicio, fecha_fin (rango inclusivo).
-- Genera una fecha por dia del rango y resuelve el codigo de turno Kardex.
WITH n AS (
    SELECT TOP (DATEDIFF(day, CAST(:fecha_inicio AS date), CAST(:fecha_fin AS date)) + 1)
        ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS dia_offset
    FROM sys.all_objects AS o1
    CROSS JOIN sys.all_objects AS o2
)
SELECT
    DATEADD(day, n.dia_offset, CAST(:fecha_inicio AS date)) AS fecha,
    RTRIM(dbo.SP_KARDEX_CB_TURNO(
        DATEADD(day, n.dia_offset, CAST(:fecha_inicio AS date)),
        :cb_codigo
    )) AS turno
FROM n
ORDER BY fecha;
