/** Tipos del módulo Evaluación 360° (Level Up). */

export type Eval360ViewId =
  | "dashboard"
  | "campanas"
  | "evaluaciones"
  | "resultados"
  | "reportes"
  | "configuracion";

export type CampanaEstado = "borrador" | "activa" | "en_progreso" | "finalizada" | "cerrada";

export type EvaluacionEstado = "pendiente" | "en_progreso" | "completada";

export type TipoEvaluador =
  | "jefe"
  | "par"
  | "subordinado"
  | "cliente"
  | "autoevaluacion";

export type BrechaEstado = "cumple" | "riesgo" | "brecha";

export type BrechaHeatmapNivel = "ninguna" | "baja" | "media" | "critica";

export type TalentoSegmento = "sobresaliente" | "estable" | "desarrollo" | "riesgo";

export interface KpiCard {
  label: string;
  value: string;
  suffix?: string;
  icon: string;
  spark: number[];
  delta: string;
  deltaPositive: boolean;
  sub: string;
}

export interface Eval360Filters {
  area: string;
  subarea: string;
  puesto: string;
  estado: string;
}

export interface Campana360 {
  id: string;
  nombre: string;
  periodo: string;
  empleados: number;
  evaluadores: number;
  avance: number;
  estado: CampanaEstado;
  descripcion?: string;
  fechaInicio?: string;
  fechaCierre?: string;
}

export interface EvaluacionAsignada {
  id: string;
  evaluado: string;
  tipoEvaluador: TipoEvaluador;
  fechaAsignacion: string;
  fechaLimite: string;
  estado: EvaluacionEstado;
}

export interface CompetenciaPuntuacion {
  nombre: string;
  autoevaluacion: number;
  evaluadores: number;
  requerida?: number;
}

export interface ComentarioGrupo {
  tipo: TipoEvaluador;
  comentarios: string[];
}

export interface BrechaCompetencia {
  competencia: string;
  requerida: number;
  actual: number;
  estado: BrechaEstado;
}

export interface CompetenciaCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  peso: number;
}

export interface TipoEvaluadorConfig {
  tipo: TipoEvaluador;
  label: string;
  ponderacion: number;
}

export interface PerfilEvaluado {
  nombre: string;
  puesto: string;
  departamento: string;
  calificacionGeneral: number;
  nivel: string;
  iniciales: string;
}

export interface EmpleadoEval360 {
  id: string;
  nombre: string;
  numero: string;
  puesto: string;
  departamento: string;
  area: string;
  subarea: string;
  planta: string;
  turno: string;
  campana: string;
  periodo: string;
  estado: EvaluacionEstado;
  calificacion: number;
  nivel: string;
  brechaPrincipal: string;
  segmento: TalentoSegmento;
  supervisor: string;
  antiguedad: string;
  iniciales: string;
  competencias: CompetenciaPuntuacion[];
  comentarios: ComentarioGrupo[];
  brechasPuesto: BrechaCompetencia[];
  accionesRecomendadas: string[];
  evolucion: { periodo: string; individual: number; departamento: number; planta: number }[];
  participacion: { tipo: string; asignadas: number; completadas: number; pct: number }[];
  distribucionEvaluadores: { tipo: string; valor: number }[];
}

export interface PlantKpisRh {
  totalEvaluados: number;
  completadas: number;
  participacionPct: number;
  promedioPlanta: number;
  competenciasRiesgo: number;
  brechasCriticas: number;
}

export interface TalentoSaludCard {
  segmento: TalentoSegmento;
  label: string;
  cantidad: number;
  pct: number;
  delta: string;
  deltaPositive: boolean;
}

export interface NineBoxCell {
  desempeno: "bajo" | "medio" | "alto";
  potencial: "bajo" | "medio" | "alto";
  empleados: string[];
  clasificacion: string;
}
