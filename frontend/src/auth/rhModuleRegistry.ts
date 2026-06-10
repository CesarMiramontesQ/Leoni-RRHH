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
  { key: "level-up", prefix: "#/level-up/resumen" },
  { key: "level-up", prefix: "#/level-up" },
  { key: "cursos", prefix: "#/cursos" },
  { key: "opls", prefix: "#/opls" },
  { key: "evidencias", prefix: "#/evidencias" },
  { key: "sugerencias", prefix: "#/sugerencias" },
  { key: "encuestas", prefix: "#/encuestas" },
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
  if (navItemId === "comedor-menu") return "comedor";
  if (navItemId === "laborales") return "dashboard";
  return navItemId;
}
