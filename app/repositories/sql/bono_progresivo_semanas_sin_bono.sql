-- Semanas con pierde_bono = 1 por empleado, sobre progresivo vigente +
-- historico, unificadas y fechadas por semana_historico.fecha_ini.
-- El WHERE se inyecta desde el repo (BonoProgresivoRepository._build_where);
-- {where} se sustituye por las clausulas de filtro (rango/scope/empleado).
SELECT sub.empleado_id AS empleado_id, COUNT(*) AS semanas
FROM (
    SELECT ip.id_empleado AS empleado_id,
           COALESCE(ip.pierde_bono, 0) AS pierde_bono,
           s.fecha_ini AS fecha_ini
    FROM incidencias_progresivo ip
    JOIN semana_historico s ON s.id = ip.id_semana
    UNION ALL
    SELECT iph.id_empleado AS empleado_id,
           COALESCE(iph.pierde_bono, 0) AS pierde_bono,
           s.fecha_ini AS fecha_ini
    FROM incidencias_progresivo_historico iph
    JOIN semana_historico s ON s.id = iph.id_semana
) AS sub
{where}
GROUP BY sub.empleado_id
