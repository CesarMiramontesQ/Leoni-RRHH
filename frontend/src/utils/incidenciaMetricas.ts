/** Métricas de incidencias de un empleado (conteos desde `incidencias_por_tipo`). */
export type EmpleadoIncidenciasMetricas = {
  total: number;
  retardos: number;
  faltasJustificadas: number;
};

/** Agrupa variantes de retardo (alineado con filtro `tipo=retardo` en API). */
export function isRetardoTipo(tipo: string): boolean {
  const tl = tipo.trim().toLowerCase();
  return tl === "retardo" || tl === "tardanza" || tl.includes("retard") || tl.includes("tardan");
}

/**
 * Falta justificada o equivalente en datos reales (p. ej. "Falta Injustificada" del import histórico).
 * Excluye tipos que solo mencionan "justific" sin falta/ausencia.
 */
export function isFaltaJustificadaTipo(tipo: string): boolean {
  const tl = tipo.trim().toLowerCase();
  if (!tl.includes("falta") && !tl.includes("ausencia")) return false;
  if (tl.includes("injustific")) return true;
  if (tl.includes("justific")) return true;
  return tl === "falta_justificada" || tl === "falta justificada";
}

export function computeIncidenciaMetricas(
  incidenciasPorTipo: Record<string, number>,
): EmpleadoIncidenciasMetricas {
  let total = 0;
  let retardos = 0;
  let faltasJustificadas = 0;

  for (const [tipo, cnt] of Object.entries(incidenciasPorTipo)) {
    const n = Number(cnt);
    if (!Number.isFinite(n) || n <= 0) continue;
    total += n;
    if (isRetardoTipo(tipo)) retardos += n;
    if (isFaltaJustificadaTipo(tipo)) faltasJustificadas += n;
  }

  return { total, retardos, faltasJustificadas };
}
