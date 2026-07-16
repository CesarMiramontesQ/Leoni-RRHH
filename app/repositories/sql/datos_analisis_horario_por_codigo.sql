-- Horario TRESS por codigo.
-- Params: ho_codigo.
SELECT
    RTRIM(h.HO_CODIGO) AS ho_codigo,
    RTRIM(h.HO_INTIME) AS ho_intime,
    RTRIM(h.HO_OUTTIME) AS ho_outtime,
    h.HO_JORNADA AS ho_jornada
FROM dbo.HORARIO h
WHERE RTRIM(h.HO_CODIGO) = :ho_codigo;
