import type {
  BrechaHeatmapNivel,
  EmpleadoEval360,
  Eval360Filters,
  PlantKpisRh,
  TalentoSaludCard,
} from "./types.ts";
import {
  BRECHAS_PERFIL_PUESTO,
  COMENTARIOS_GRUPO,
  DISTRIBUCION_EVALUADORES,
  PARTICIPACION_POR_TIPO,
  RADAR_COMPETENCIAS,
} from "./mockData.ts";

const COMPETENCIAS_ORG = ["Liderazgo", "Comunicación", "Trabajo en equipo", "Adaptabilidad", "Orientación a resultados"] as const;

const DEPTOS_ORG = ["Producción", "Calidad", "Logística", "Mantenimiento", "Ingeniería", "RH"] as const;

export const MOCK_EMPLEADOS_EVAL360: EmpleadoEval360[] = [
  mkEmp("e001", "Sandra Peña Rojas", "10482", "Supervisora de Calidad", "Calidad", "Calidad", "Hermosillo", "Matutino", "Evaluación Liderazgo Q2 2026", "Q2 2026", "completada", 4.3, "Sobresaliente", "Desarrollo de personal", "sobresaliente", "Hugo Cárdenas Olvera", "8 años"),
  mkEmp("e002", "Roberto Sánchez Mora", "10231", "Supervisor de línea", "Producción", "Cableado L1", "Hermosillo", "Matutino", "Evaluación Liderazgo Q2 2026", "Q2 2026", "completada", 4.2, "Sobresaliente", "Adaptabilidad", "sobresaliente", "Patricia Loera Beltrán", "6 años"),
  mkEmp("e003", "Patricia Loera Beltrán", "10105", "Líder de área", "Producción", "Ensamble L2", "Hermosillo", "Vespertino", "Evaluación Anual 2025", "Q1 2026", "completada", 4.1, "Sobresaliente", "Resolución de problemas", "estable", "Jorge Salazar Núñez", "11 años"),
  mkEmp("e004", "Jorge Salazar Núñez", "10388", "Coordinador", "Producción", "Cableado L1", "Hermosillo", "Matutino", "Onboarding Líderes Nuevos", "Q2 2026", "en_progreso", 3.9, "Competente", "Desarrollo de personal", "estable", "Rafael Cuevas Trejo", "5 años"),
  mkEmp("e005", "Laura Villarreal Nava", "10501", "Supervisora de línea", "Producción", "Ensamble L5", "Hermosillo", "Mixto", "Evaluación Liderazgo Q2 2026", "Q2 2026", "completada", 3.8, "Competente", "Adaptabilidad", "desarrollo", "Diego Hurtado Vidal", "4 años"),
  mkEmp("e006", "Diego Hurtado Vidal", "10612", "Supervisor de línea", "Producción", "Cableado L3", "Hermosillo", "Vespertino", "Evaluación Liderazgo Q2 2026", "Q2 2026", "en_progreso", 3.5, "En desarrollo", "Liderazgo", "desarrollo", "Brenda Valdez Aguilar", "3 años"),
  mkEmp("e007", "Hugo Cárdenas Olvera", "10089", "Gerente de planta adj.", "Producción", "Operaciones RH", "Hermosillo", "Matutino", "Evaluación Anual 2025", "Q1 2026", "completada", 4.0, "Sobresaliente", "Comunicación", "estable", "Director Operaciones", "14 años"),
  mkEmp("e008", "Brenda Valdez Aguilar", "10720", "Supervisora de línea", "Producción", "Cableado L1", "Hermosillo", "Matutino", "Evaluación Liderazgo Q2 2026", "Q2 2026", "pendiente", 0, "—", "—", "riesgo", "Roberto Sánchez Mora", "2 años"),
  mkEmp("e009", "Raúl Jiménez Paredes", "10833", "Coordinador logístico", "Logística", "Operaciones RH", "Hermosillo", "Vespertino", "Evaluación Anual 2025", "Q1 2026", "completada", 3.2, "En desarrollo", "Orientación a resultados", "riesgo", "Ana Karina Reséndiz", "7 años"),
  mkEmp("e010", "Carlos Duarte Ibarra", "10901", "Jefe de mantenimiento", "Mantenimiento", "Mantenimiento", "Hermosillo", "Mixto", "Evaluación Anual 2025", "Q1 2026", "completada", 3.6, "Competente", "Trabajo en equipo", "desarrollo", "Hugo Cárdenas Olvera", "9 años"),
  mkEmp("e011", "Gabriela Fuentes Díaz", "10945", "Ingeniera de procesos", "Ingeniería", "Calidad", "Hermosillo", "Matutino", "Evaluación Liderazgo Q2 2026", "Q2 2026", "completada", 4.0, "Sobresaliente", "Adaptabilidad", "sobresaliente", "Sandra Peña Rojas", "6 años"),
  mkEmp("e012", "Ana Karina Reséndiz", "11002", "Analista RH", "RH", "Operaciones RH", "Hermosillo", "Matutino", "Evaluación Anual 2025", "Q1 2026", "completada", 3.9, "Competente", "Liderazgo", "estable", "Director RH", "5 años"),
];

function mkEmp(
  id: string,
  nombre: string,
  numero: string,
  puesto: string,
  departamento: string,
  area: string,
  planta: string,
  turno: string,
  campana: string,
  periodo: string,
  estado: EmpleadoEval360["estado"],
  calificacion: number,
  nivel: string,
  brechaPrincipal: string,
  segmento: EmpleadoEval360["segmento"],
  supervisor: string,
  antiguedad: string,
): EmpleadoEval360 {
  const iniciales = nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const factor = calificacion > 0 ? calificacion / 4.1 : 0.85;
  return {
    id,
    nombre,
    numero,
    puesto,
    departamento,
    area,
    planta,
    turno,
    campana,
    periodo,
    estado,
    calificacion,
    nivel,
    brechaPrincipal,
    segmento,
    supervisor,
    antiguedad,
    iniciales,
    competencias: RADAR_COMPETENCIAS.map((c) => ({
      ...c,
      autoevaluacion: +(c.autoevaluacion * factor).toFixed(1),
      evaluadores: +(c.evaluadores * factor).toFixed(1),
    })),
    comentarios: COMENTARIOS_GRUPO,
    brechasPuesto: BRECHAS_PERFIL_PUESTO.map((b) => ({
      ...b,
      actual: +(b.actual * factor).toFixed(1),
    })),
    accionesRecomendadas: [
      calificacion >= 4 ? "Revisar plan de sucesión" : "Asignar capacitación",
      brechaPrincipal !== "—" ? `Monitorear brecha: ${brechaPrincipal}` : "Programar sesión de retroalimentación",
      "Crear plan de desarrollo",
    ],
    evolucion: [
      { periodo: "2024 Q3", individual: +(3.2 * factor).toFixed(1), departamento: 3.4, planta: 3.3 },
      { periodo: "2024 Q4", individual: +(3.4 * factor).toFixed(1), departamento: 3.5, planta: 3.4 },
      { periodo: "2025 Q1", individual: +(3.5 * factor).toFixed(1), departamento: 3.6, planta: 3.5 },
      { periodo: "2025 Q2", individual: +(3.6 * factor).toFixed(1), departamento: 3.7, planta: 3.6 },
      { periodo: "2025 Q3", individual: +(3.7 * factor).toFixed(1), departamento: 3.7, planta: 3.7 },
      { periodo: "2025 Q4", individual: +(3.8 * factor).toFixed(1), departamento: 3.8, planta: 3.7 },
      { periodo: "2026 Q1", individual: +(calificacion || 3.8 * factor).toFixed(1), departamento: 3.8, planta: 3.8 },
    ],
    participacion: PARTICIPACION_POR_TIPO.map((p) => ({ ...p })),
    distribucionEvaluadores: DISTRIBUCION_EVALUADORES.map((d) => ({
      tipo: d.tipo,
      valor: Math.round(d.valor * factor),
    })),
  };
}

export function filterEmpleadosEval360(
  empleados: EmpleadoEval360[],
  filters: Eval360Filters,
  search: string,
): EmpleadoEval360[] {
  const q = search.trim().toLowerCase();
  return empleados.filter((e) => {
    if (filters.planta && e.planta !== filters.planta) return false;
    if (filters.departamento && e.departamento !== filters.departamento) return false;
    if (filters.area && e.area !== filters.area) return false;
    if (filters.puesto && e.puesto !== filters.puesto) return false;
    if (filters.turno && e.turno !== filters.turno) return false;
    if (filters.campana && e.campana !== filters.campana) return false;
    if (filters.periodo && e.periodo !== filters.periodo) return false;
    if (filters.estado && e.estado !== filters.estado) return false;
    if (q) {
      const hay = [e.nombre, e.numero, e.puesto, e.departamento].some((s) => s.toLowerCase().includes(q));
      if (!hay) return false;
    }
    return true;
  });
}

export function computePlantKpis(empleados: EmpleadoEval360[]): PlantKpisRh {
  const evaluados = empleados.length;
  const completadas = empleados.filter((e) => e.estado === "completada").length;
  const conNota = empleados.filter((e) => e.calificacion > 0);
  const promedioPlanta =
    conNota.length > 0 ? conNota.reduce((s, e) => s + e.calificacion, 0) / conNota.length : 0;
  const brechasCriticas = empleados.filter((e) => e.segmento === "riesgo" || e.brechaPrincipal !== "—").length;
  return {
    totalEvaluados: evaluados,
    completadas,
    participacionPct: evaluados > 0 ? Math.round((completadas / evaluados) * 100) : 0,
    promedioPlanta: +promedioPlanta.toFixed(1),
    competenciasRiesgo: empleados.filter((e) => e.brechaPrincipal === "Adaptabilidad" || e.brechaPrincipal === "Desarrollo de personal").length,
    brechasCriticas,
  };
}

export function computeTalentoSalud(empleados: EmpleadoEval360[]): TalentoSaludCard[] {
  const total = empleados.length || 1;
  const count = (seg: EmpleadoEval360["segmento"]) => empleados.filter((e) => e.segmento === seg).length;
  const cards: TalentoSaludCard[] = [
    { segmento: "sobresaliente", label: "Talento sobresaliente", cantidad: count("sobresaliente"), pct: 0, delta: "+3", deltaPositive: true },
    { segmento: "estable", label: "Talento estable", cantidad: count("estable"), pct: 0, delta: "+1", deltaPositive: true },
    { segmento: "desarrollo", label: "Talento en desarrollo", cantidad: count("desarrollo"), pct: 0, delta: "-2", deltaPositive: false },
    { segmento: "riesgo", label: "Talento en riesgo", cantidad: count("riesgo"), pct: 0, delta: "-2", deltaPositive: true },
  ];
  return cards.map((c) => ({ ...c, pct: Math.round((c.cantidad / total) * 100) }));
}

/** Promedio por departamento y competencia (mock derivado de empleados filtrados). */
export function computeCompetenciasPorDepartamento(empleados: EmpleadoEval360[]): {
  departamentos: string[];
  competencias: string[];
  matrix: number[][];
} {
  const departamentos = [...DEPTOS_ORG];
  const competencias = [...COMPETENCIAS_ORG];
  const matrix = departamentos.map((dept, di) =>
    competencias.map((comp, ci) => {
      const subset = empleados.filter((e) => e.departamento === dept && e.calificacion > 0);
      if (subset.length === 0) return +(3.1 + di * 0.05 + ci * 0.03).toFixed(1);
      const vals = subset.flatMap((e) => {
        const c = e.competencias.find((x) => x.nombre.startsWith(comp.split(" ")[0]!) || x.nombre === comp);
        return c ? [c.evaluadores] : [e.calificacion * 0.9];
      });
      return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    }),
  );
  return { departamentos, competencias, matrix };
}

export function computeBrechaHeatmap(empleados: EmpleadoEval360[]): {
  departamentos: string[];
  competencias: string[];
  matrix: BrechaHeatmapNivel[][];
} {
  const departamentos = [...DEPTOS_ORG];
  const competencias = [...COMPETENCIAS_ORG];
  const matrix = departamentos.map((dept) =>
    competencias.map((comp) => {
      const subset = empleados.filter((e) => e.departamento === dept);
      const gaps = subset.map((e) => {
        const b = e.brechasPuesto.find((x) => x.competencia.startsWith(comp.split(" ")[0]!) || x.competencia === comp);
        if (!b) return 0;
        return Math.max(0, b.requerida - b.actual);
      });
      const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0.3;
      if (avg <= 0.1) return "ninguna" as const;
      if (avg <= 0.4) return "baja" as const;
      if (avg <= 0.8) return "media" as const;
      return "critica" as const;
    }),
  );
  return { departamentos, competencias, matrix };
}

export function getTopDestacados(empleados: EmpleadoEval360[], limit = 5) {
  return [...empleados]
    .filter((e) => e.calificacion > 0)
    .sort((a, b) => b.calificacion - a.calificacion)
    .slice(0, limit);
}

export function getBrechaCriticaList(empleados: EmpleadoEval360[], limit = 5) {
  return empleados
    .filter((e) => e.segmento === "riesgo" || e.brechaPrincipal !== "—")
    .slice(0, limit)
    .map((e) => ({
      nombre: e.nombre,
      competencia: e.brechaPrincipal,
      brecha: e.calificacion > 0 ? "Alta" : "Sin evaluar",
      accion: e.calificacion > 0 ? "Asignar plan de desarrollo" : "Completar evaluación 360°",
    }));
}

export function getNecesidadesCapacitacion(empleados: EmpleadoEval360[]) {
  const map = new Map<string, number>();
  for (const e of empleados) {
    if (e.brechaPrincipal && e.brechaPrincipal !== "—") {
      map.set(e.brechaPrincipal, (map.get(e.brechaPrincipal) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([competencia, afectados]) => ({
      competencia,
      afectados,
      prioridad: afectados >= 3 ? "Alta" : afectados >= 2 ? "Media" : "Baja",
    }))
    .sort((a, b) => b.afectados - a.afectados);
}

export function getEmpleadoById(id: string | null): EmpleadoEval360 | undefined {
  if (!id) return undefined;
  return MOCK_EMPLEADOS_EVAL360.find((e) => e.id === id);
}
