// Tipos del flujo de encuestas post curso (Level Up).
// Mantener sincronizado con app/schemas/level_up_encuestas.py

export type EstadoEncuestaEfectivo = "no_habilitada" | "activa" | "cerrada";

export const ESTADO_ENCUESTA_LABELS: Record<EstadoEncuestaEfectivo, string> = {
  no_habilitada: "No habilitada",
  activa: "Activa",
  cerrada: "Cerrada",
};

export const ESTADO_ENCUESTA_BADGE: Record<EstadoEncuestaEfectivo, string> = {
  no_habilitada: "border-slate-200 bg-slate-50 text-slate-600",
  activa: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cerrada: "border-amber-200 bg-amber-50 text-amber-800",
};

export interface EncuestaEstado {
  id: number | null;
  curso_id: number;
  sesion_id: number;
  estado_efectivo: EstadoEncuestaEfectivo;
  fecha_limite: string | null;
  fecha_cierre: string | null;
  total_asistentes: number;
  respondidas: number;
  pendientes: number;
}

export interface EncuestaRespuestaInput {
  score_general: number;
  score_instructor: number;
  score_contenido: number;
  score_aplicabilidad: number;
  comentario?: string | null;
}

export interface EncuestaRespuesta {
  id: number;
  encuesta_id: number;
  curso_id: number;
  sesion_id: number;
  empleado_id: number;
  score_general: number;
  score_instructor: number;
  score_contenido: number;
  score_aplicabilidad: number;
  comentario: string | null;
  fecha: string;
}

export interface EncuestaPendiente {
  encuesta_id: number;
  curso_id: number;
  curso_nombre: string | null;
  sesion_id: number;
  fecha_sesion: string | null;
  fecha_limite: string | null;
}

export interface EncuestaPendienteList {
  items: EncuestaPendiente[];
  total: number;
}

export interface EncuestaDetalle {
  encuesta_id: number;
  curso_id: number;
  curso_nombre: string | null;
  sesion_id: number;
  fecha_sesion: string | null;
  estado_efectivo: EstadoEncuestaEfectivo;
  fecha_limite: string | null;
  ya_respondida: boolean;
}

export interface DistribucionItem {
  score: number;
  cantidad: number;
}

export interface ComentarioItem {
  sesion_id: number;
  empleado_nombre: string | null;
  score_general: number;
  comentario: string;
  fecha: string;
}

export interface EncuestaSesionResultado {
  sesion_id: number;
  fecha_sesion: string | null;
  estado_efectivo: EstadoEncuestaEfectivo;
  total_asistentes: number;
  respondidas: number;
  tasa_participacion: number;
  promedio_general: number | null;
  promedio_instructor: number | null;
  promedio_contenido: number | null;
  promedio_aplicabilidad: number | null;
}

export interface CursoEncuestasResumen {
  curso_id: number;
  curso_nombre: string | null;
  calificacion_promedio: number | null;
  total_evaluaciones: number;
  promedio_instructor: number | null;
  promedio_contenido: number | null;
  promedio_aplicabilidad: number | null;
  distribucion: DistribucionItem[];
  sesiones: EncuestaSesionResultado[];
  comentarios: ComentarioItem[];
}

export interface DashboardCursoItem {
  curso_id: number;
  curso_nombre: string;
  instructor_nombre: string | null;
  proveedor_nombre: string | null;
  total_evaluaciones: number;
  promedio_general: number | null;
  promedio_instructor: number | null;
  promedio_contenido: number | null;
  promedio_aplicabilidad: number | null;
}

export interface EncuestasDashboard {
  total_evaluaciones: number;
  score_medio: number | null;
  cursos_evaluados: number;
  cursos_en_alerta: number;
  distribucion: DistribucionItem[];
  cursos: DashboardCursoItem[];
  comentarios: ComentarioItem[];
}
