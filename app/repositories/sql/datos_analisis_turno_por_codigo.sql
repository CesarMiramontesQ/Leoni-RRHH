-- Definicion de turno TRESS (fijo / rotativo).
-- Params: tu_codigo (ya sin padding requerido; se compara con RTRIM).
SELECT
    RTRIM(t.TU_CODIGO) AS tu_codigo,
    t.TU_RIT_PAT AS tu_rit_pat,
    t.TU_RIT_INI AS tu_rit_ini,
    t.TU_TIP_1 AS tu_tip_1,
    t.TU_TIP_2 AS tu_tip_2,
    t.TU_TIP_3 AS tu_tip_3,
    t.TU_TIP_4 AS tu_tip_4,
    t.TU_TIP_5 AS tu_tip_5,
    t.TU_TIP_6 AS tu_tip_6,
    t.TU_TIP_7 AS tu_tip_7,
    RTRIM(t.TU_HOR_1) AS tu_hor_1,
    RTRIM(t.TU_HOR_2) AS tu_hor_2,
    RTRIM(t.TU_HOR_3) AS tu_hor_3,
    RTRIM(t.TU_HOR_4) AS tu_hor_4,
    RTRIM(t.TU_HOR_5) AS tu_hor_5,
    RTRIM(t.TU_HOR_6) AS tu_hor_6,
    RTRIM(t.TU_HOR_7) AS tu_hor_7
FROM dbo.TURNO t
WHERE RTRIM(t.TU_CODIGO) = :tu_codigo;
