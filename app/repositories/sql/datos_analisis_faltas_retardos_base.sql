-- Incidencias unificadas desde datos-analisis (TRESS). SOLO LECTURA.
--
-- Rama A (dbo.AUSENCIA): un renglon por empleado por dia para FI, RE, SUS, VAC y las
--   incapacidades del IMSS (INC, IN1, IAC, ITR), mas los dias FJ que NO estan
--   cubiertos por un permiso con goce (esos salen de la rama B como un solo
--   renglon con rango, para no duplicarlos).
-- Rama B (dbo.PERMISO): permisos con goce (PM_TIPO FJ, PM_CLASIFI 0) como UN
--   renglon con rango. PM_FEC_FIN es EXCLUSIVA en TRESS, por eso el fin que se
--   muestra es PM_FEC_FIN menos un dia.
--
-- Solo para los retardos (AU_TIPO 'RE') la rama A resuelve tambien la hora
--   programada (dbo.HORARIO.HO_INTIME por el HO_CODIGO del dia) y la hora real de
--   entrada. La entrada de la jornada es la checada con CH_TIPO 1 y CH_POSICIO 1: sin
--   la posicion se colaria el regreso de comer, que tambien es una checada de entrada.
--   El predicado de tipo vive DENTRO del APPLY para que no se toque CHECADAS (millones
--   de filas) en las incidencias que no son retardos. Las horas viajan crudas ('HHMM',
--   con horas >= 24 para el turno que cruza medianoche); las formatea Python.
--
-- El tipo de permiso solo vive en PM_COMENTA, que es texto libre, asi que se
-- clasifica por palabra clave. El COLLATE CI_AI ignora mayusculas y acentos
-- (la BD es CI_AS, o sea DEFUNCION no atraparia DEFUNCION con acento).
--
-- AU_STATUS no se filtra a proposito. El valor 2 (descanso) solo aparece en
-- incapacidades, que si cubren los dias de descanso; excluirlas perderia dias
-- validos.
--
-- Binds: fecha_inicio (date o NULL), fecha_fin (date o NULL),
--        cb_codigos_csv (varchar(max) con numeros de empleado separados por
--        coma; NULL = sin filtro por empleado).
--
-- Nota: no usar tokens con dos puntos en los comentarios; SQLAlchemy text() los
-- toma como binds.

SELECT
    CAST('ausencia' AS varchar(16))                              AS origen,
    a.LLAVE                                                      AS origen_id,
    a.CB_CODIGO                                                  AS no_empleado,
    CASE RTRIM(a.AU_TIPO)
        WHEN 'FJ'  THEN 'falta_justificada'
        WHEN 'FI'  THEN 'falta_injustificada'
        WHEN 'RE'  THEN 'retardo'
        WHEN 'SUS' THEN 'suspension'
        WHEN 'VAC' THEN 'vacaciones'
        ELSE 'incapacidad'
    END                                                          AS tipo,
    CONVERT(date, a.AU_FECHA)                                    AS fecha_evento,
    CAST(NULL AS date)                                           AS fecha_fin,
    CAST(pm.comentario AS varchar(255))                          AS observaciones,
    CONVERT(date, pm.fecha_captura)                              AS fecha_registro,
    CAST(CASE WHEN RTRIM(a.AU_TIPO) = 'RE' THEN h.HO_INTIME END AS char(4)) AS hora_programada,
    CAST(ch.CH_H_REAL AS char(4))                                AS hora_entrada
FROM dbo.AUSENCIA a
LEFT JOIN dbo.HORARIO h ON h.HO_CODIGO = a.HO_CODIGO
OUTER APPLY (
    SELECT TOP (1) c.CH_H_REAL
    FROM dbo.CHECADAS c
    WHERE RTRIM(a.AU_TIPO) = 'RE'
      AND c.CB_CODIGO  = a.CB_CODIGO
      AND c.AU_FECHA   = a.AU_FECHA
      AND c.CH_TIPO    = 1
      AND c.CH_POSICIO = 1
    ORDER BY c.CH_H_REAL
) ch
OUTER APPLY (
    SELECT TOP (1)
        LTRIM(RTRIM(p2.PM_COMENTA)) AS comentario,
        p2.PM_CAPTURA               AS fecha_captura
    FROM dbo.PERMISO p2
    WHERE p2.CB_CODIGO = a.CB_CODIGO
      AND p2.PM_TIPO   = a.AU_TIPO
      AND a.AU_FECHA  >= p2.PM_FEC_INI
      AND a.AU_FECHA   < p2.PM_FEC_FIN
    ORDER BY p2.PM_FEC_INI DESC
) pm
WHERE a.AU_TIPO IN ('FI', 'RE', 'FJ', 'SUS', 'INC', 'IN1', 'IAC', 'ITR', 'VAC')
  AND (CAST(:fecha_inicio AS date) IS NULL OR a.AU_FECHA >= CAST(:fecha_inicio AS date))
  AND (CAST(:fecha_fin AS date) IS NULL OR a.AU_FECHA < DATEADD(day, 1, CAST(:fecha_fin AS date)))
  AND (
        CAST(:cb_codigos_csv AS varchar(max)) IS NULL
        OR a.CB_CODIGO IN (
            SELECT TRY_CAST(LTRIM(RTRIM(s.value)) AS int)
            FROM STRING_SPLIT(CAST(:cb_codigos_csv AS varchar(max)), ',') AS s
            WHERE LTRIM(RTRIM(s.value)) <> ''
        )
      )
  AND NOT (
        a.AU_TIPO = 'FJ'
        AND EXISTS (
            SELECT 1
            FROM dbo.PERMISO g
            WHERE g.CB_CODIGO  = a.CB_CODIGO
              AND g.PM_TIPO    = 'FJ'
              AND g.PM_CLASIFI = 0
              AND a.AU_FECHA  >= g.PM_FEC_INI
              AND a.AU_FECHA   < g.PM_FEC_FIN
        )
      )

UNION ALL

SELECT
    CAST('permiso' AS varchar(16))                               AS origen,
    p.LLAVE                                                      AS origen_id,
    p.CB_CODIGO                                                  AS no_empleado,
    CASE
        WHEN p.PM_COMENTA COLLATE Latin1_General_CI_AI LIKE '%MATRIMONIO%'
          OR p.PM_COMENTA COLLATE Latin1_General_CI_AI LIKE '%BODA%'
            THEN 'matrimonio'
        WHEN p.PM_COMENTA COLLATE Latin1_General_CI_AI LIKE '%DEFUNCION%'
          OR p.PM_COMENTA COLLATE Latin1_General_CI_AI LIKE '%FALLECIMIENTO%'
            THEN 'defuncion'
        WHEN p.PM_COMENTA COLLATE Latin1_General_CI_AI LIKE '%PATERNIDAD%'
            THEN 'paternidad'
        ELSE 'falta_justificada'
    END                                                          AS tipo,
    CONVERT(date, p.PM_FEC_INI)                                  AS fecha_evento,
    CONVERT(date, DATEADD(day, -1, p.PM_FEC_FIN))                AS fecha_fin,
    CAST(NULLIF(LTRIM(RTRIM(p.PM_COMENTA)), '') AS varchar(255)) AS observaciones,
    CONVERT(date, p.PM_CAPTURA)                                  AS fecha_registro,
    CAST(NULL AS char(4))                                        AS hora_programada,
    CAST(NULL AS char(4))                                        AS hora_entrada
FROM dbo.PERMISO p
WHERE p.PM_TIPO = 'FJ'
  AND p.PM_CLASIFI = 0
  AND p.PM_FEC_FIN > p.PM_FEC_INI
  AND (CAST(:fecha_inicio AS date) IS NULL
       OR CONVERT(date, DATEADD(day, -1, p.PM_FEC_FIN)) >= CAST(:fecha_inicio AS date))
  AND (CAST(:fecha_fin AS date) IS NULL
       OR CONVERT(date, p.PM_FEC_INI) <= CAST(:fecha_fin AS date))
  AND (
        CAST(:cb_codigos_csv AS varchar(max)) IS NULL
        OR p.CB_CODIGO IN (
            SELECT TRY_CAST(LTRIM(RTRIM(s.value)) AS int)
            FROM STRING_SPLIT(CAST(:cb_codigos_csv AS varchar(max)), ',') AS s
            WHERE LTRIM(RTRIM(s.value)) <> ''
        )
      )
