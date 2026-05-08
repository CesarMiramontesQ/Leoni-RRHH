/**
 * Títulos de página para el navbar y document.title según la ruta hash (`#/…`).
 * Orden: rutas más específicas primero.
 */
const REGLAS: ReadonlyArray<{ match: (hash: string) => boolean; titulo: string }> = [
  { match: (h) => /^#\/empleados\/\d+/.test(h), titulo: "Vista 360" },
  { match: (h) => /^#\/actas\/\d+/.test(h), titulo: "Detalle de acta" },
  { match: (h) => h.startsWith("#/comedor/reporte"), titulo: "Reporte comedor" },
  { match: (h) => h.startsWith("#/comedor/codigos-externos"), titulo: "Listado de códigos externos" },
  { match: (h) => h.startsWith("#/comedor/planear"), titulo: "Configuración de Menú Semanal" },
  { match: (h) => h.startsWith("#/organigrama"), titulo: "Organigrama empresarial" },
  { match: (h) => h.startsWith("#/empleados"), titulo: "Empleados" },
  { match: (h) => h.startsWith("#/comedor"), titulo: "Comedor" },
  { match: (h) => h.startsWith("#/notificaciones"), titulo: "Notificaciones" },
  { match: (h) => h.startsWith("#/solicitudes"), titulo: "Solicitudes" },
  { match: (h) => h.startsWith("#/evaluaciones"), titulo: "Evaluaciones" },
  { match: (h) => h.startsWith("#/incidencias"), titulo: "Incidencias" },
  { match: (h) => h.startsWith("#/actas"), titulo: "Actas" },
  { match: (h) => h.startsWith("#/reportes"), titulo: "Reporte comedor" },
  { match: (h) => h.startsWith("#/puestos"), titulo: "Perfiles de Puesto" },
  { match: (h) => h.startsWith("#/competencias"), titulo: "Matriz de Competencias" },
  { match: (h) => h === "#/" || h === "#" || h === "", titulo: "Dashboard" },
];

/** Título por defecto cuando no coincide ninguna regla (p. ej. rutas futuras). */
const TITULO_DEFAULT = "Dashboard";

export function tituloDesdeHash(hash: string): string {
  const h = (hash || "#/").trim() || "#/";
  for (const { match, titulo } of REGLAS) {
    if (match(h)) return titulo;
  }
  return TITULO_DEFAULT;
}
