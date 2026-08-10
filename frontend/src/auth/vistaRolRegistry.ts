/**
 * Espejo de `app/core/vista_rol_registry.py`: resolución de ruta hash → vista y de
 * ítem de navegación → vista, para las vistas configurables por rol base.
 *
 * Se mantiene a mano igual que `rhModuleRegistry.ts`; `vistaRolRegistry.test.ts`
 * verifica que no se desalinee del catálogo que devuelve el backend.
 */
import { hashSinQuery } from "../utils/hashQuery.ts";

/** Roles cuyo acceso administra el admin RH desde `#/ajustes/vistas-rol`. */
export const ROLES_CONFIGURABLES = ["empleado", "supervisor", "gerente"] as const;

export type RolConfigurable = (typeof ROLES_CONFIGURABLES)[number];

export function isRolConfigurable(rol: string | null): rol is RolConfigurable {
  return (ROLES_CONFIGURABLES as readonly string[]).includes(rol ?? "");
}

/** Ítem del sidebar → vista. Un ítem sin entrada no es configurable. */
const NAV_ITEM_RULES: Readonly<Record<string, string>> = {
  dashboard: "dashboard",
  organigrama: "organigrama",
  empleados: "empleados",
  "level-up": "level-up",
  comedor: "comedor",
  "mis-evaluaciones": "mis-evaluaciones",
  "mis-encuestas": "mis-encuestas",
  "mis-encuestas-rh": "mis-encuestas-rh",
  "mis-firmas": "mis-firmas",
  "mis-aprobaciones-opl": "mis-aprobaciones-opl",
  "mis-metas": "mis-metas",
  "mi-desempeno": "mi-desempeno",
  solicitudes: "solicitudes",
  metricas: "metricas",
  incidencias: "incidencias",
  "faltas-retardos": "faltas-retardos",
  actas: "actas",
  "viajes-laborales": "viajes-laborales",
  reportes: "reportes",
  "comedor-gestion": "comedor-gestion",
  "comedor-planear": "comedor-planear",
  "comedor-ajustes": "comedor-ajustes",
  "horas-extra": "nominas-horas-extra",
  conciliacion: "nominas-conciliacion",
  "nominas-ajustes": "nominas-ajustes",
  puestos: "puestos",
  wtw: "puestos",
  competencias: "competencias",
  capacidades: "competencias",
  "tareas-catalogo": "tareas-catalogo",
  "puestos-ajustes": "puestos-ajustes",
  "dashboard-talento": "dashboard-talento",
  "encuestas-rh": "encuestas-rh",
  operaciones: "operaciones",
  evaluaciones: "evaluaciones",
  metas: "metas",
  "ciclo-desempeno": "ciclo-desempeno",
  "historial-objetivo": "historial-objetivo",
  "evaluacion-360": "evaluacion-360",
  "pdi-gestion": "pdi-gestion",
  cursos: "cursos",
  "cursos-seguimiento": "cursos-seguimiento",
  sesiones: "sesiones",
  capacitaciones: "capacitaciones",
  encuestas: "encuestas",
  "cursos-ajustes": "cursos-ajustes",
  "cursos-juntas": "juntas",
  opls: "opls",
  evidencias: "evidencias",
  sugerencias: "sugerencias",
  "cursos-proveedores": "proveedores-externos",
  "cursos-externos": "cursos-externos",
  "cursos-vencimientos": "cursos-vencimientos",
};

/**
 * Regla B: registrar y aprobar horas extra dependen ÚNICAMENTE de los claims de nómina
 * (`he_autorizado` / `he_aprobador`), nunca del rol ni de un permiso de módulo. Sus ítems
 * ya están fuera de NAV_ITEM_RULES, pero sus rutas caen bajo el prefijo
 * `#/nominas/horas-extra` de la vista «Horas Extra» —apagada de fábrica para los roles
 * base—, así que sin esta exención el gate las bloqueaba antes de que la Regla B pudiera
 * decidir: un empleado designado aprobador veía "Acceso no autorizado".
 */
const HASH_EXENTOS_REGLA_B: readonly string[] = [
  "#/horas-extra/solicitud",
  "#/nominas/horas-extra/aprobaciones",
];

/** Ruta hash → vista. Gana el prefijo más largo (igual que el backend). */
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
  { key: "comedor-ajustes", prefix: "#/comedor/ajustes" },
  { key: "comedor", prefix: "#/comedor" },
  { key: "mis-evaluaciones", prefix: "#/mis-evaluaciones" },
  { key: "mis-encuestas", prefix: "#/mis-encuestas" },
  { key: "mis-encuestas-rh", prefix: "#/talento/mis-encuestas" },
  { key: "mis-firmas", prefix: "#/mis-firmas" },
  { key: "mis-aprobaciones-opl", prefix: "#/mis-aprobaciones-opl" },
  { key: "mis-metas", prefix: "#/talento/mis-metas" },
  { key: "mi-desempeno", prefix: "#/talento/mi-desempeno" },
  { key: "puestos-ajustes", prefix: "#/puestos/ajustes" },
  { key: "puestos", prefix: "#/puestos" },
  { key: "tareas-catalogo", prefix: "#/tareas-catalogo" },
  { key: "competencias", prefix: "#/capacidades" },
  { key: "competencias", prefix: "#/competencias" },
  { key: "operaciones", prefix: "#/operaciones" },
  { key: "evaluaciones", prefix: "#/evaluaciones" },
  { key: "pdi-gestion", prefix: "#/pdi-gestion" },
  { key: "evaluacion-360", prefix: "#/level-up/evaluacion-360" },
  { key: "level-up", prefix: "#/level-up" },
  { key: "cursos-seguimiento", prefix: "#/cursos/seguimiento" },
  { key: "cursos-ajustes", prefix: "#/cursos/ajustes" },
  { key: "juntas", prefix: "#/cursos/juntas" },
  { key: "proveedores-externos", prefix: "#/cursos/proveedores" },
  { key: "cursos-externos", prefix: "#/cursos/externos" },
  { key: "cursos-vencimientos", prefix: "#/cursos/vencimientos" },
  { key: "cursos", prefix: "#/cursos" },
  { key: "sesiones", prefix: "#/sesiones" },
  { key: "capacitaciones", prefix: "#/capacitaciones" },
  { key: "opls", prefix: "#/opls" },
  { key: "evidencias", prefix: "#/evidencias" },
  { key: "sugerencias", prefix: "#/sugerencias" },
  { key: "encuestas", prefix: "#/encuestas" },
  { key: "encuestas-rh", prefix: "#/talento/encuestas" },
  { key: "metas", prefix: "#/talento/metas" },
  { key: "dashboard-talento", prefix: "#/talento/dashboard" },
  { key: "ciclo-desempeno", prefix: "#/talento/ciclo-desempeno" },
  { key: "historial-objetivo", prefix: "#/cumplimiento/historial-objetivo" },
  { key: "nominas-horas-extra", prefix: "#/nominas/horas-extra" },
  { key: "nominas-conciliacion", prefix: "#/nominas/conciliacion" },
  { key: "nominas-ajustes", prefix: "#/nominas/ajustes" },
].sort((a, b) => b.prefix.length - a.prefix.length);

export function resolveVistaFromHash(hashValue: string): string | null {
  // Mismo motivo que en rhModuleRegistry: sin quitar el query string un deep-link
  // como `#/operaciones?area_id=3` no casaría con ningún prefijo y saltaría la compuerta.
  const h = hashSinQuery((hashValue || "#/").trim());
  if (h === "" || h === "#" || h === "#/") return "dashboard";
  if (HASH_EXENTOS_REGLA_B.some((prefix) => h.startsWith(prefix))) return null;
  for (const rule of HASH_RULES) {
    if (h === rule.prefix || h.startsWith(`${rule.prefix}/`) || h.startsWith(rule.prefix)) {
      return rule.key;
    }
  }
  return null;
}

export function navItemToVistaKey(navItemId: string): string | null {
  return NAV_ITEM_RULES[navItemId] ?? null;
}
