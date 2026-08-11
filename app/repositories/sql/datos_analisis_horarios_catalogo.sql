-- Catalogo de jornadas de TRESS. SOLO LECTURA. Sin parametros.
--
-- Alimenta la replica levelup_horarios, de donde Ajustes Comedor saca a que hora entra y
-- sale cada jornada. Ninguna carga de pagina pasa por aqui; solo el sync de la madrugada.
--
-- Se replica el subconjunto que el proyecto lee, no las 32 columnas del origen: el resto
-- (tolerancias de retardo, banderas de checada de comida, cuentas contables) pertenece al
-- calculo de nomina, que este sistema no hace.
--
-- HO_CODIGO viene con relleno de CHAR(6) y aqui SI se normaliza con RTRIM, porque la
-- tabla destino guarda el codigo ya normalizado: los codigos con los que se consulta
-- llegan sin relleno desde RTRIM(TU_HOR_n) y desde los tokens del patron rotativo.
--
-- HO_INTIME y HO_OUTTIME son char(4) tipo 0600 o 2200; se traen crudos y se convierten
-- en Python con parse_hora_tress. Una jornada puede cruzar medianoche, asi que la salida
-- no es necesariamente mayor que la entrada.
--
-- Nota: no usar tokens con dos puntos en los comentarios; SQLAlchemy text() los toma
-- como parametros de enlace.
SELECT RTRIM(h.HO_CODIGO)  AS ho_codigo,
       h.HO_DESCRIP        AS ho_descrip,
       h.HO_INTIME         AS ho_intime,
       h.HO_OUTTIME        AS ho_outtime,
       h.HO_JORNADA        AS ho_jornada,
       h.HO_ACTIVO         AS ho_activo
FROM dbo.HORARIO h
WHERE RTRIM(h.HO_CODIGO) <> '';
