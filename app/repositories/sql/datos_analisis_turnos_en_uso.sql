-- Personal activo por turno desde datos-analisis (TRESS). SOLO LECTURA.
--
-- Alimenta la caché levelup_turnos_uso, que es lo que la pantalla de Ajustes Comedor
-- consulta para mostrar unicamente los turnos en uso. Ninguna carga de pagina pasa por
-- aqui: solo el sync.
--
-- dbo.COLABORA es la tabla base de colaboradores de TRESS. CB_TURNO es char(6) con
-- relleno de espacios, asi que se normaliza con RTRIM para que case con el catalogo
-- replicado (levelup_turnos.tu_codigo).
--
-- Se cuentan solo los activos (CB_ACTIVO = 'S'); las bajas conservan su ultimo turno y
-- contarlas inflaria turnos que ya nadie trabaja.
--
-- Los colaboradores sin turno asignado se descartan: no aportan a ningun turno del
-- catalogo.
--
-- Nota: no usar tokens con dos puntos en los comentarios; SQLAlchemy text() los toma
-- como binds.
SELECT
    RTRIM(CB_TURNO) AS tu_codigo,
    COUNT(*) AS empleados_activos
FROM dbo.COLABORA
WHERE RTRIM(CB_ACTIVO) = 'S'
  AND CB_TURNO IS NOT NULL
  AND RTRIM(CB_TURNO) <> ''
GROUP BY RTRIM(CB_TURNO);
