/**
 * Títulos de página para el navbar y document.title según la ruta hash (`#/…`).
 * Orden: rutas más específicas primero.
 */
const REGLAS: ReadonlyArray<{ match: (hash: string) => boolean; titulo: string }> = [
  { match: (h) => /^#\/empleados\/\d+/.test(h), titulo: "Vista 360" },
  { match: (h) => h.startsWith("#/empleados"), titulo: "Empleados" },
  { match: (h) => h.startsWith("#/solicitudes"), titulo: "Solicitudes" },
  { match: (h) => h.startsWith("#/incidencias"), titulo: "Incidencias laborales" },
  { match: (h) => h.startsWith("#/reportes"), titulo: "Reportes" },
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
