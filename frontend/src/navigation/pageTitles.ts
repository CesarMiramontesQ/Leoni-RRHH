/**
 * Títulos de página para el navbar y document.title según la ruta hash (`#/…`).
 * Orden: rutas más específicas primero.
 */
const REGLAS: ReadonlyArray<{ match: (hash: string) => boolean; titulo: string }> = [
  { match: (h) => /^#\/empleados\/\d+/.test(h), titulo: "Vista 360" },
  { match: (h) => /^#\/actas\/\d+/.test(h), titulo: "Detalle de acta" },
  { match: (h) => h.startsWith("#/comedor/reporte"), titulo: "Reporte comedor" },
  { match: (h) => h.startsWith("#/comedor/codigos-externos"), titulo: "Listado de códigos externos" },
  { match: (h) => h.startsWith("#/comedor/planear"), titulo: "Planeación de Menú" },
  { match: (h) => h.startsWith("#/organigrama"), titulo: "Organigrama empresarial" },
  { match: (h) => h.startsWith("#/empleados"), titulo: "Empleados" },
  { match: (h) => h.startsWith("#/comedor"), titulo: "Comedor" },
  { match: (h) => h.startsWith("#/notificaciones"), titulo: "Notificaciones" },
  { match: (h) => h.startsWith("#/metricas"), titulo: "Métricas" },
  { match: (h) => h.startsWith("#/solicitudes"), titulo: "Solicitudes" },
  { match: (h) => h.startsWith("#/pdi-gestion"), titulo: "Gestión PDI" },
  { match: (h) => h.startsWith("#/evaluaciones"), titulo: "Evaluaciones" },
  { match: (h) => h.startsWith("#/incidencias"), titulo: "Incidencias" },
  { match: (h) => h.startsWith("#/faltas-retardos"), titulo: "Faltas y retardos" },
  { match: (h) => h.startsWith("#/actas"), titulo: "Actas" },
  { match: (h) => h.startsWith("#/reportes"), titulo: "Reporte comedor" },
  { match: (h) => h.startsWith("#/puestos/ajustes"), titulo: "Ajustes para perfiles de puesto" },
  { match: (h) => h.startsWith("#/puestos"), titulo: "Perfiles de Puesto" },
  { match: (h) => h.startsWith("#/competencias"), titulo: "Matriz de Competencias" },
  { match: (h) => h.startsWith("#/capacidades"), titulo: "Matriz de Multihabilidades" },
  { match: (h) => h.startsWith("#/cursos/seguimiento"), titulo: "Seguimiento de capacitaciones" },
  { match: (h) => h.startsWith("#/cursos/ajustes"), titulo: "Ajustes de cursos" },
  { match: (h) => h.startsWith("#/cursos/juntas"), titulo: "Juntas" },
  { match: (h) => h.startsWith("#/cursos/proveedores"), titulo: "Contratistas" },
  { match: (h) => h.startsWith("#/cursos/externos"), titulo: "Cursos externos" },
  { match: (h) => h.startsWith("#/cursos/vencimientos"), titulo: "Vencimientos" },
  { match: (h) => h.startsWith("#/cursos"), titulo: "Manejo de Cursos" },
  { match: (h) => h.startsWith("#/opls"), titulo: "Manejo de OPLs" },
  { match: (h) => h.startsWith("#/evidencias"), titulo: "Motor de Evidencias" },
  { match: (h) => h.startsWith("#/sugerencias"), titulo: "Motor de Sugerencias" },
  { match: (h) => h.startsWith("#/encuestas"), titulo: "Encuestas Post Curso" },
  { match: (h) => h.startsWith("#/nominas/conciliacion"), titulo: "Conciliación" },
  { match: (h) => h.startsWith("#/nominas/ajustes"), titulo: "Ajustes de Nóminas" },
  { match: (h) => h.startsWith("#/horas-extra/solicitud"), titulo: "Solicitud de horas extra" },
  { match: (h) => h.startsWith("#/nominas/horas-extra/aprobaciones"), titulo: "Aprobación de Horas Extra" },
  { match: (h) => h.startsWith("#/nominas/horas-extra"), titulo: "Horas Extra" },
  { match: (h) => h.startsWith("#/laborales"), titulo: "Laborales" },
  { match: (h) => h.startsWith("#/comedor/accesos"), titulo: "Comedor" },
  { match: (h) => h.startsWith("#/level-up/evaluacion-360/empleados"), titulo: "Empleados · Evaluación 360°" },
  { match: (h) => h.startsWith("#/level-up/evaluacion-360"), titulo: "Evaluación 360°" },
  { match: (h) => h.startsWith("#/level-up/resumen"), titulo: "Resumen operativo Level Up" },
  { match: (h) => h.startsWith("#/sesiones"), titulo: "Sesiones de Cursos" },
  { match: (h) => h.startsWith("#/tareas-catalogo"), titulo: "Catalogo de Tareas" },
  { match: (h) => h.startsWith("#/level-up"), titulo: "Level Up" },
  { match: (h) => h.startsWith("#/ajustes/permisos-rh"), titulo: "Permisos RH" },
  { match: (h) => h.startsWith("#/rh-inicio"), titulo: "Modo RH" },
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
