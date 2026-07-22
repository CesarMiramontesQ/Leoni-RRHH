/**
 * Resolución de rutas hash → módulo RH (alineado con app/core/rh_module_registry.py).
 */

const HASH_RULES: ReadonlyArray<{ key: string; prefix: string }> = [
  { key: "organigrama", prefix: "#/organigrama" },
  { key: "empleados", prefix: "#/empleados" },
  { key: "metricas", prefix: "#/metricas" },
  { key: "solicitudes", prefix: "#/solicitudes" },
  { key: "incidencias", prefix: "#/incidencias" },
  { key: "faltas-retardos", prefix: "#/faltas-retardos" },
  { key: "viajes-laborales", prefix: "#/viajes-laborales" },
  { key: "actas", prefix: "#/actas" },
  { key: "reportes", prefix: "#/comedor/reporte" },
  { key: "reportes", prefix: "#/reportes" },
  { key: "comedor-gestion", prefix: "#/comedor/gestion" },
  { key: "comedor-gestion", prefix: "#/comedor/codigos-externos" },
  { key: "comedor-planear", prefix: "#/comedor/planear" },
  { key: "comedor-registro", prefix: "#/comedor" },
  { key: "puestos-ajustes", prefix: "#/puestos/ajustes" },
  { key: "puestos", prefix: "#/puestos" },
  { key: "tareas-catalogo", prefix: "#/tareas-catalogo" },
  { key: "capacidades", prefix: "#/capacidades" },
  { key: "competencias", prefix: "#/competencias" },
  { key: "evaluaciones", prefix: "#/evaluaciones" },
  { key: "pdi-gestion", prefix: "#/pdi-gestion" },
  { key: "evaluacion-360", prefix: "#/level-up/evaluacion-360" },
  { key: "level-up", prefix: "#/level-up/resumen" },
  { key: "level-up", prefix: "#/level-up" },
  { key: "cursos-seguimiento", prefix: "#/cursos/seguimiento" },
  { key: "cursos-ajustes", prefix: "#/cursos/ajustes" },
  { key: "juntas", prefix: "#/cursos/juntas" },
  { key: "proveedores-externos", prefix: "#/cursos/proveedores" },
  { key: "cursos-externos", prefix: "#/cursos/externos" },
  { key: "cursos-vencimientos", prefix: "#/cursos/vencimientos" },
  { key: "cursos", prefix: "#/cursos" },
  { key: "sesiones", prefix: "#/sesiones" },
  { key: "opls", prefix: "#/opls" },
  { key: "evidencias", prefix: "#/evidencias" },
  { key: "sugerencias", prefix: "#/sugerencias" },
  { key: "encuestas", prefix: "#/encuestas" },
  { key: "encuestas-rh", prefix: "#/talento/encuestas" },
  { key: "metas", prefix: "#/talento/metas" },
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
  if (navItemId === "cursos-juntas") return "juntas";
  if (navItemId === "cursos-proveedores") return "proveedores-externos";
  if (navItemId === "comedor-menu" || navItemId === "comedor") return "comedor-registro";
  if (navItemId === "comedor-gestion") return "comedor-gestion";
  if (navItemId === "comedor-planear") return "comedor-planear";
  if (navItemId === "laborales") return "dashboard";
  if (navItemId === "horas-extra") return "nominas-horas-extra";
  if (navItemId === "conciliacion") return "nominas-conciliacion";
  if (navItemId === "nominas") return "nominas-horas-extra";
  return navItemId;
}
