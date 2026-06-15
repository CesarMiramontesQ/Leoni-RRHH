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
  { key: "nominas", prefix: "#/nominas/horas-extra" },
  { key: "nominas", prefix: "#/nominas/conciliacion" },
  { key: "nominas", prefix: "#/nominas/ajustes" },
  { key: "nominas", prefix: "#/nominas" },
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
  if (navItemId === "laborales") return "dashboard";
  if (navItemId === "nominas") return "nominas";
  if (navItemId === "horas-extra") return "nominas";
  if (navItemId === "horas-extra-aprobaciones") return "nominas";
  if (navItemId === "conciliacion") return "nominas";
  if (navItemId === "nominas-ajustes") return "nominas";
  return navItemId;
}
