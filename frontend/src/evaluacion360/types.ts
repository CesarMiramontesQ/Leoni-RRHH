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

export interface NineBoxCell {
  desempeno: "bajo" | "medio" | "alto";
  potencial: "bajo" | "medio" | "alto";
  empleados: string[];
  clasificacion: string;
}
