/**
 * Resolución de rutas hash → módulo RH (alineado con app/core/rh_module_registry.py).
 */

const HASH_RULES: ReadonlyArray<{ key: string; prefix: string }> = [
  { key: "organigrama", prefix: "#/organigrama" },
  { key: "empleados", prefix: "#/empleados" },
  { key: "metricas", prefix: "#/metricas" },
  { key: "solicitudes", prefix: "#/solicitudes" },
  { key: "incidencias", prefix: "#/incidencias" },
  { key: "actas", prefix: "#/actas" },
  { key: "reportes", prefix: "#/comedor/reporte" },
  { key: "reportes", prefix: "#/reportes" },
  { key: "comedor", prefix: "#/comedor/gestion" },
  { key: "comedor", prefix: "#/comedor/planear" },
  { key: "comedor", prefix: "#/comedor/codigos-externos" },
  { key: "puestos", prefix: "#/puestos" },
  { key: "tareas-catalogo", prefix: "#/tareas-catalogo" },
  { key: "capacidades", prefix: "#/capacidades" },
  { key: "competencias", prefix: "#/competencias" },
  { key: "evaluaciones", prefix: "#/evaluaciones" },
  { key: "capacitaciones", prefix: "#/capacitaciones" },
  { key: "level-up", prefix: "#/level-up/evaluacion-360" },
  { key: "level-up", prefix: "#/level-up/resumen" },
  { key: "level-up", prefix: "#/level-up" },
  { key: "cursos", prefix: "#/cursos" },
  { key: "opls", prefix: "#/opls" },
  { key: "evidencias", prefix: "#/evidencias" },
  { key: "sugerencias", prefix: "#/sugerencias" },
  { key: "encuestas", prefix: "#/encuestas" },
  { key: "nominas-horas-extra", prefix: "#/nominas/horas-extra" },
  { key: "nominas-conciliacion", prefix: "#/nominas/conciliacion" },
  { key: "nominas-ajustes", prefix: "#/nominas/ajustes" },
].sort((a, b) => b.prefix.length - a.prefix.length);

export function resolveModuleFromHash(hashValue: string): string | null {
  const h = (hashValue || "#/").trim();
  if (h === "" || h === "#" || h === "#/") return "dashboard";
  for (const rule of HASH_RULES) {
    if (h === rule.prefix || h.startsWith(`${rule.prefix}/`)) {
      return rule.key;
    }
  }
  return null;
}

export function navItemIdToModuleKey(navItemId: string): string {
  if (navItemId === "puestos-ajustes") return "puestos";
  if (navItemId === "cursos-ajustes") return "cursos";
  if (navItemId === "sesiones") return "cursos";
  if (navItemId === "comedor-menu") return "comedor";
  if (navItemId === "comedor-gestion" || navItemId === "comedor-planear") return "comedor";
  if (navItemId === "laborales") return "dashboard";
  // Evaluación 360 vive bajo el módulo Level Up (no es un módulo propio).
  if (navItemId === "evaluacion-360") return "level-up";
  // Nóminas: un módulo de navegación por página del submenú.
  if (navItemId === "horas-extra") return "nominas-horas-extra";
  if (navItemId === "conciliacion") return "nominas-conciliacion";
  if (navItemId === "nominas-ajustes") return "nominas-ajustes";
  // El hub "nominas" se resuelve aparte (isNominasHubVisibleForRol) y
  // "horas-extra-aprobaciones" es Regla B (canApproveOvertime), no un módulo.
  if (navItemId === "nominas") return "nominas-horas-extra";
  return navItemId;
}
