import type {
  BrechaCompetencia,
  Campana360,
  ComentarioGrupo,
  CompetenciaCatalogo,
  CompetenciaPuntuacion,
  EvaluacionAsignada,
  KpiCard,
  NineBoxCell,
  PerfilEvaluado,
  TipoEvaluadorConfig,
} from "./types.ts";

export const EVAL360_KPIS: KpiCard[] = [
  {
    label: "Campañas activas",
    value: "3",
    icon: "target",
    spark: [1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3],
    delta: "+1",
    deltaPositive: true,
    sub: "vs. Q1 2026",
  },
  {
    label: "Evaluaciones enviadas",
    value: "428",
    icon: "send",
    spark: [280, 310, 340, 360, 375, 390, 400, 410, 418, 422, 425, 428],
    delta: "+18%",
    deltaPositive: true,
    sub: "vs. periodo anterior",
  },
  {
    label: "Evaluaciones completadas",
    value: "312",
    icon: "check",
    spark: [180, 200, 220, 240, 255, 265, 275, 285, 295, 302, 308, 312],
    delta: "+22%",
    deltaPositive: true,
    sub: "vs. periodo anterior",
  },
  {
    label: "Participación",
    value: "73",
    suffix: "%",
    icon: "users",
    spark: [58, 60, 62, 64, 66, 67, 68, 69, 70, 71, 72, 73],
    delta: "+5 pts",
    deltaPositive: true,
    sub: "vs. periodo anterior",
  },
  {
    label: "Empleados evaluados",
    value: "86",
    icon: "user-check",
    spark: [52, 58, 62, 65, 68, 72, 74, 78, 80, 82, 84, 86],
    delta: "+12",
    deltaPositive: true,
    sub: "vs. periodo anterior",
  },
  {
    label: "Promedio general",
    value: "3.8",
    suffix: "/5",
    icon: "star",
    spark: [32, 33, 34, 35, 36, 36, 37, 37, 38, 38, 38, 38],
    delta: "+0.3",
    deltaPositive: true,
    sub: "vs. periodo anterior",
  },
];

export const RESUMEN_GENERAL = {
  empleadosEvaluados: 86,
  evaluadoresAsignados: 312,
  evaluacionesPendientes: 116,
  evaluacionesCompletadas: 312,
};

export const DISTRIBUCION_EVALUADORES = [
  { tipo: "Jefe directo", valor: 86, pct: 28 },
  { tipo: "Pares", valor: 124, pct: 40 },
  { tipo: "Subordinados", valor: 42, pct: 13 },
  { tipo: "Clientes", valor: 18, pct: 6 },
  { tipo: "Autoevaluación", valor: 42, pct: 13 },
];

export const PARTICIPACION_POR_TIPO = [
  { tipo: "Jefe directo", asignadas: 86, completadas: 78, pct: 91 },
  { tipo: "Pares", asignadas: 124, completadas: 88, pct: 71 },
  { tipo: "Subordinados", asignadas: 42, completadas: 30, pct: 71 },
  { tipo: "Clientes", asignadas: 18, completadas: 10, pct: 56 },
  { tipo: "Autoevaluación", asignadas: 86, completadas: 82, pct: 95 },
];

export const COMPETENCIAS_MEJOR_EVALUADAS = [
  { nombre: "Liderazgo", puntuacion: 4.2 },
  { nombre: "Comunicación", puntuacion: 4.1 },
  { nombre: "Trabajo en equipo", puntuacion: 4.0 },
  { nombre: "Orientación a resultados", puntuacion: 3.9 },
];

export const COMPETENCIAS_OPORTUNIDAD = [
  { nombre: "Adaptabilidad", puntuacion: 2.8 },
  { nombre: "Desarrollo de personal", puntuacion: 2.9 },
  { nombre: "Resolución de problemas", puntuacion: 3.0 },
];

export const BRECHAS_ORGANIZACIONALES = [
  { competencia: "Liderazgo", requerida: 4, actual: 4.2 },
  { competencia: "Comunicación", requerida: 4, actual: 4.1 },
  { competencia: "Adaptabilidad", requerida: 3.5, actual: 2.8 },
  { competencia: "Desarrollo de personal", requerida: 3.5, actual: 2.9 },
  { competencia: "Resolución de problemas", requerida: 4, actual: 3.0 },
];

export const MOCK_CAMPANAS: Campana360[] = [
  {
    id: "C360-2026-Q2",
    nombre: "Evaluación Liderazgo Q2 2026",
    periodo: "Abr – Jun 2026",
    empleados: 42,
    evaluadores: 168,
    avance: 68,
    estado: "en_progreso",
    descripcion: "Campaña focalizada en competencias de liderazgo y gestión de equipos.",
    fechaInicio: "2026-04-01",
    fechaCierre: "2026-06-30",
  },
  {
    id: "C360-2026-Q1",
    nombre: "Evaluación Anual 2025",
    periodo: "Ene – Mar 2026",
    empleados: 86,
    evaluadores: 312,
    avance: 100,
    estado: "finalizada",
    descripcion: "Evaluación 360° anual para mandos medios y supervisores.",
    fechaInicio: "2026-01-15",
    fechaCierre: "2026-03-31",
  },
  {
    id: "C360-DRAFT-01",
    nombre: "Piloto Área Calidad",
    periodo: "Jul 2026",
    empleados: 14,
    evaluadores: 0,
    avance: 0,
    estado: "borrador",
    descripcion: "Piloto para validar competencias técnicas en área de calidad.",
    fechaInicio: "2026-07-01",
    fechaCierre: "2026-07-31",
  },
  {
    id: "C360-2025-H2",
    nombre: "Evaluación Mandos Medios H2",
    periodo: "Sep – Dic 2025",
    empleados: 38,
    evaluadores: 142,
    avance: 100,
    estado: "cerrada",
    descripcion: "Campaña cerrada — resultados integrados al plan de sucesión.",
    fechaInicio: "2025-09-01",
    fechaCierre: "2025-12-15",
  },
  {
    id: "C360-ACTIVA-01",
    nombre: "Onboarding Líderes Nuevos",
    periodo: "May 2026",
    empleados: 8,
    evaluadores: 32,
    avance: 25,
    estado: "activa",
    descripcion: "Evaluación 90 días para nuevos líderes de línea.",
    fechaInicio: "2026-05-01",
    fechaCierre: "2026-05-31",
  },
];

export const MOCK_EVALUACIONES: EvaluacionAsignada[] = [
  { id: "EV-001", evaluado: "Sandra Peña Rojas", tipoEvaluador: "jefe", fechaAsignacion: "01/05/26", fechaLimite: "15/06/26", estado: "en_progreso" },
  { id: "EV-002", evaluado: "Hugo Cárdenas Olvera", tipoEvaluador: "par", fechaAsignacion: "01/05/26", fechaLimite: "15/06/26", estado: "pendiente" },
  { id: "EV-003", evaluado: "Patricia Loera Beltrán", tipoEvaluador: "subordinado", fechaAsignacion: "03/05/26", fechaLimite: "20/06/26", estado: "completada" },
  { id: "EV-004", evaluado: "Jorge Salazar Núñez", tipoEvaluador: "cliente", fechaAsignacion: "05/05/26", fechaLimite: "25/06/26", estado: "pendiente" },
  { id: "EV-005", evaluado: "Rafael Cuevas Trejo", tipoEvaluador: "autoevaluacion", fechaAsignacion: "01/05/26", fechaLimite: "10/06/26", estado: "completada" },
  { id: "EV-006", evaluado: "Laura Villarreal Nava", tipoEvaluador: "par", fechaAsignacion: "08/05/26", fechaLimite: "22/06/26", estado: "en_progreso" },
  { id: "EV-007", evaluado: "Diego Hurtado Vidal", tipoEvaluador: "jefe", fechaAsignacion: "10/05/26", fechaLimite: "30/06/26", estado: "pendiente" },
  { id: "EV-008", evaluado: "Brenda Valdez Aguilar", tipoEvaluador: "par", fechaAsignacion: "12/05/26", fechaLimite: "30/06/26", estado: "completada" },
];

export const PERFIL_EVALUADO: PerfilEvaluado = {
  nombre: "Sandra Peña Rojas",
  puesto: "Supervisora de Calidad",
  departamento: "Calidad · Planta Hermosillo",
  calificacionGeneral: 4.1,
  nivel: "Sobresaliente",
  iniciales: "SP",
};

export const RADAR_COMPETENCIAS: CompetenciaPuntuacion[] = [
  { nombre: "Liderazgo", autoevaluacion: 4.2, evaluadores: 4.0 },
  { nombre: "Comunicación", autoevaluacion: 4.5, evaluadores: 4.1 },
  { nombre: "Trabajo en equipo", autoevaluacion: 4.0, evaluadores: 4.2 },
  { nombre: "Responsabilidad", autoevaluacion: 4.3, evaluadores: 4.0 },
  { nombre: "Orientación a resultados", autoevaluacion: 3.8, evaluadores: 4.1 },
  { nombre: "Adaptabilidad", autoevaluacion: 3.5, evaluadores: 3.2 },
  { nombre: "Resolución de problemas", autoevaluacion: 3.9, evaluadores: 3.7 },
  { nombre: "Desarrollo de personal", autoevaluacion: 3.6, evaluadores: 3.4 },
];

export const COMENTARIOS_GRUPO: ComentarioGrupo[] = [
  {
    tipo: "jefe",
    comentarios: [
      "Demuestra liderazgo sólido en situaciones de presión y mantiene al equipo enfocado.",
      "Podría delegar más tareas operativas para enfocarse en desarrollo estratégico.",
    ],
  },
  {
    tipo: "par",
    comentarios: [
      "Excelente comunicación transversal entre áreas de producción y calidad.",
      "A veces prioriza perfeccionismo sobre velocidad de entrega.",
    ],
  },
  {
    tipo: "subordinado",
    comentarios: [
      "Brinda retroalimentación constructiva y reconoce logros del equipo.",
      "Sería valioso más tiempo dedicado a coaching individual.",
    ],
  },
  {
    tipo: "cliente",
    comentarios: [
      "Respuesta ágil ante no conformidades reportadas por el cliente OEM.",
    ],
  },
];

export const BRECHAS_PERFIL_PUESTO: BrechaCompetencia[] = [
  { competencia: "Liderazgo", requerida: 4, actual: 4.0, estado: "cumple" },
  { competencia: "Comunicación", requerida: 4, actual: 4.1, estado: "cumple" },
  { competencia: "Adaptabilidad", requerida: 3.5, actual: 3.2, estado: "riesgo" },
  { competencia: "Desarrollo de personal", requerida: 4, actual: 3.4, estado: "brecha" },
  { competencia: "Resolución de problemas", requerida: 4, actual: 3.7, estado: "riesgo" },
];

export const CATALOGO_COMPETENCIAS: CompetenciaCatalogo[] = [
  { id: "comp-01", nombre: "Liderazgo", descripcion: "Capacidad de guiar equipos hacia objetivos compartidos.", peso: 20 },
  { id: "comp-02", nombre: "Comunicación", descripcion: "Transmisión clara de ideas y escucha activa.", peso: 15 },
  { id: "comp-03", nombre: "Trabajo en equipo", descripcion: "Colaboración efectiva en entornos multidisciplinarios.", peso: 15 },
  { id: "comp-04", nombre: "Orientación a resultados", descripcion: "Enfoque en metas medibles y mejora continua.", peso: 15 },
  { id: "comp-05", nombre: "Adaptabilidad", descripcion: "Flexibilidad ante cambios de proceso y contexto.", peso: 10 },
  { id: "comp-06", nombre: "Resolución de problemas", descripcion: "Análisis estructurado y toma de decisiones.", peso: 10 },
  { id: "comp-07", nombre: "Desarrollo de personal", descripcion: "Coaching y crecimiento del talento a cargo.", peso: 15 },
];

export const ESCALA_EVALUACION = [
  { valor: 1, etiqueta: "Deficiente" },
  { valor: 2, etiqueta: "En desarrollo" },
  { valor: 3, etiqueta: "Competente" },
  { valor: 4, etiqueta: "Sobresaliente" },
  { valor: 5, etiqueta: "Experto" },
];

export const TIPOS_EVALUADOR_CONFIG: TipoEvaluadorConfig[] = [
  { tipo: "jefe", label: "Jefe", ponderacion: 30 },
  { tipo: "par", label: "Par", ponderacion: 25 },
  { tipo: "subordinado", label: "Subordinado", ponderacion: 20 },
  { tipo: "cliente", label: "Cliente", ponderacion: 10 },
  { tipo: "autoevaluacion", label: "Autoevaluación", ponderacion: 15 },
];

export const REPORTE_CARDS = [
  { titulo: "Top líderes mejor evaluados", items: ["Sandra Peña Rojas · 4.3", "Roberto Sánchez Mora · 4.2", "Patricia Loera Beltrán · 4.1"] },
  { titulo: "Departamentos con mejor desempeño", items: ["Calidad · 4.1", "Prueba Eléctrica · 3.9", "Cableado L1 · 3.8"] },
  { titulo: "Competencias con menor puntuación", items: ["Adaptabilidad · 2.8", "Desarrollo de personal · 2.9", "Resolución de problemas · 3.0"] },
  { titulo: "Empleados listos para promoción", items: ["Jorge Salazar Núñez", "Laura Villarreal Nava", "Roberto Sánchez Mora"] },
];

export const EVOLUCION_HISTORICA = [
  { periodo: "2024 Q3", valor: 3.2 },
  { periodo: "2024 Q4", valor: 3.4 },
  { periodo: "2025 Q1", valor: 3.5 },
  { periodo: "2025 Q2", valor: 3.6 },
  { periodo: "2025 Q3", valor: 3.7 },
  { periodo: "2025 Q4", valor: 3.7 },
  { periodo: "2026 Q1", valor: 3.8 },
];

export const COMPARATIVO_DEPARTAMENTO = [
  { dept: "Calidad", valor: 4.1 },
  { dept: "Cableado", valor: 3.7 },
  { dept: "Ensamble", valor: 3.6 },
  { dept: "Mantenimiento", valor: 3.5 },
  { dept: "Prueba Eléc.", valor: 3.9 },
];

export const TENDENCIAS_COMPETENCIA = [
  { competencia: "Liderazgo", q1: 3.8, q2: 4.0, q3: 4.1, q4: 4.2 },
  { competencia: "Comunicación", q1: 3.7, q2: 3.9, q3: 4.0, q4: 4.1 },
  { competencia: "Adaptabilidad", q1: 2.6, q2: 2.7, q3: 2.8, q4: 2.8 },
];

export const HEATMAP_DATA: { dept: string; competencias: number[] }[] = [
  { dept: "Calidad", competencias: [4.2, 4.1, 4.0, 3.8, 3.2, 3.5, 3.6] },
  { dept: "Cableado", competencias: [3.8, 3.7, 3.9, 3.8, 2.9, 3.1, 3.2] },
  { dept: "Ensamble", competencias: [3.6, 3.5, 3.8, 3.7, 2.8, 3.0, 3.1] },
  { dept: "Mantenim.", competencias: [3.5, 3.4, 3.6, 3.5, 2.7, 3.2, 3.0] },
];

export const NINE_BOX: NineBoxCell[] = [
  { desempeno: "alto", potencial: "alto", empleados: ["Sandra Peña", "Roberto Sánchez"], clasificacion: "Talento clave" },
  { desempeno: "alto", potencial: "medio", empleados: ["Patricia Loera", "Jorge Salazar"], clasificacion: "Consistentes" },
  { desempeno: "alto", potencial: "bajo", empleados: ["Hugo Cárdenas"], clasificacion: "Consistentes" },
  { desempeno: "medio", potencial: "alto", empleados: ["Laura Villarreal", "Diego Hurtado"], clasificacion: "Promovibles" },
  { desempeno: "medio", potencial: "medio", empleados: ["Brenda Valdez", "Adrián Carmona", "Lucía Mendoza"], clasificacion: "Consistentes" },
  { desempeno: "medio", potencial: "bajo", empleados: ["Raúl Jiménez"], clasificacion: "Necesitan desarrollo" },
  { desempeno: "bajo", potencial: "alto", empleados: ["Fernando Estrada"], clasificacion: "Promovibles" },
  { desempeno: "bajo", potencial: "medio", empleados: ["Claudia Rivas", "Tomás Ibarra"], clasificacion: "Necesitan desarrollo" },
  { desempeno: "bajo", potencial: "bajo", empleados: ["Iván Bermúdez"], clasificacion: "Necesitan desarrollo" },
];
