-- Catalogo completo de turnos de TRESS. SOLO LECTURA. Sin parametros.
--
-- Alimenta la replica levelup_turnos, que es de donde Ajustes Comedor saca el patron de
-- rotacion (TU_RIT_PAT) y su fecha ancla (TU_RIT_INI). Ninguna carga de pagina pasa por
-- aqui; solo el sync de la madrugada.
--
-- Se traen las 40 columnas porque la tabla destino las declara NOT NULL y el sync tiene
-- que poder INSERTAR un turno nuevo, no solo actualizar los que ya existen.
--
-- No se aplica RTRIM a nada: la replica es fiel al origen. TU_CODIGO conserva su relleno
-- de CHAR(6) y TU_RIT_PAT conserva sus CRLF, que son significativos al expandir el ritmo.
--
-- Nota: no usar tokens con dos puntos en los comentarios; SQLAlchemy text() los toma
-- como parametros de enlace.
SELECT t.TU_CODIGO  AS tu_codigo,
       t.TU_DESCRIP AS tu_descrip,
       t.TU_DIAS    AS tu_dias,
       t.TU_DOBLES  AS tu_dobles,
       t.TU_DOMINGO AS tu_domingo,
       t.TU_FESTIVO AS tu_festivo,
       t.TU_HOR_1   AS tu_hor_1,
       t.TU_HOR_2   AS tu_hor_2,
       t.TU_HOR_3   AS tu_hor_3,
       t.TU_HOR_4   AS tu_hor_4,
       t.TU_HOR_5   AS tu_hor_5,
       t.TU_HOR_6   AS tu_hor_6,
       t.TU_HOR_7   AS tu_hor_7,
       t.TU_HORARIO AS tu_horario,
       t.TU_JORNADA AS tu_jornada,
       t.TU_NOMINA  AS tu_nomina,
       t.TU_RIT_INI AS tu_rit_ini,
       t.TU_RIT_PAT AS tu_rit_pat,
       t.TU_TIP_1   AS tu_tip_1,
       t.TU_TIP_2   AS tu_tip_2,
       t.TU_TIP_3   AS tu_tip_3,
       t.TU_TIP_4   AS tu_tip_4,
       t.TU_TIP_5   AS tu_tip_5,
       t.TU_TIP_6   AS tu_tip_6,
       t.TU_TIP_7   AS tu_tip_7,
       t.TU_TIP_JOR AS tu_tip_jor,
       t.TU_INGLES  AS tu_ingles,
       t.TU_TEXTO   AS tu_texto,
       t.TU_NUMERO  AS tu_numero,
       t.TU_HOR_FES AS tu_hor_fes,
       t.TU_VACA_HA AS tu_vaca_ha,
       t.TU_VACA_SA AS tu_vaca_sa,
       t.TU_VACA_DE AS tu_vaca_de,
       t.TU_SUB_CTA AS tu_sub_cta,
       t.TU_DIAS_BA AS tu_dias_ba,
       t.TU_ACTIVO  AS tu_activo,
       t.TU_TIP_JT  AS tu_tip_jt,
       t.LLAVE      AS llave,
       t.TU_NIVEL0  AS tu_nivel0,
       t.TU_SAT_JOR AS tu_sat_jor
FROM dbo.TURNO t;
